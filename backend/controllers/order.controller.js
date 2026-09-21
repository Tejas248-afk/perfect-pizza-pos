const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Branch = require('../models/Branch');

// Safe Number Helper (Prevents NaN crashes)
const safeNum = (val) => {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

// Helper: Extract clean 10 digits
const get10DigitPhone = (p) => String(p || '').replace(/\D/g, '').slice(-10);

// Smart Regex Matcher: Matches last 10 digits even if DB has +91, spaces or dashes
const buildPhoneRegex = (phoneStr) => {
  const digits = get10DigitPhone(phoneStr);
  if (digits.length < 10) return null;
  const regexPattern = digits.split('').join('\\D*') + '$';
  return new RegExp(regexPattern, 'i');
};

// Helper: ₹20 = 1 Coin
const calculateEarnedCoins = (amount) => Math.floor(safeNum(amount) / 20);

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const createOrder = async (req, res) => {
  try {
    const {
      orderType,
      customerPhone,
      customerName,
      customerAddress,
      deliveryAddress,
      items,
      subtotal,
      discount,
      rewardCoinsUsed = 0,
      rewardCoinsValue = 0,
      serviceCharge = 0,
      deliveryCharge = 0,
      gstAmount = 0,
      grandTotal = 0,
      paymentMethod = 'cash',
    } = req.body;

    const branchId = req.user?.branch?._id || req.user?.branch;
    const type = String(orderType || '').toLowerCase().trim();
    const payMethod = String(paymentMethod || 'cash').toLowerCase().trim();

    // 1. Generate Invoice Number
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return res.status(404).json({ message: 'Branch not found' });
    }

    const invoiceNo = `${branch.invoicePrefix}${branch.currentInvoiceNumber}`;
    branch.currentInvoiceNumber += 1;
    await branch.save();

    // 2. Customer & Coins Persistence (Fail-Safe)
    let customer = null;
    let rewardCoinsEarned = 0;

    const cleanPhone = get10DigitPhone(customerPhone);
    const hasValidPhone = cleanPhone.length === 10;
    const phoneRegex = buildPhoneRegex(cleanPhone);
    const inputName = customerName ? String(customerName).trim() : '';
    const inputAddr = String(deliveryAddress || customerAddress || '').trim();
    const isPendingPayment = payMethod === 'pending';

    if (hasValidPhone && phoneRegex) {
      // Find customer by flexible phone regex match
      customer = await Customer.findOne({
        $or: [
          { phone: phoneRegex },
          { phone: cleanPhone },
          { phone: { $regex: cleanPhone + '$' } }
        ]
      });

      if (!customer) {
        customer = new Customer({
          branch: branchId,
          phone: cleanPhone,
          name: (inputName && inputName.toLowerCase() !== 'guest') ? inputName : 'Guest',
          address: inputAddr,
          rewardCoins: 0,
          totalOrders: 0,
          totalSpent: 0,
        });
      } else {
        customer.phone = cleanPhone; // Normalize phone to 10 digits
        if (inputName && inputName.toLowerCase() !== 'guest') {
          customer.name = inputName;
        }
        if (inputAddr) {
          customer.address = inputAddr;
        }
      }

      // Deduct Used Coins Safely
      let coinsToRedeem = safeNum(rewardCoinsUsed);
      if (coinsToRedeem > 0) {
        let currentBalance = safeNum(customer.rewardCoins);
        if (currentBalance < coinsToRedeem) {
          coinsToRedeem = Math.floor(currentBalance / 20) * 20;
        }
        customer.rewardCoins = Math.max(0, currentBalance - coinsToRedeem);
      }

      // Earn Coins (Only if not a pending table start)
      if (!isPendingPayment) {
        rewardCoinsEarned = calculateEarnedCoins(grandTotal);
        customer.rewardCoins = safeNum(customer.rewardCoins) + rewardCoinsEarned;
        customer.totalOrders = safeNum(customer.totalOrders) + 1;
        customer.totalSpent = safeNum(customer.totalSpent) + safeNum(grandTotal);
      }

      await customer.save();
    }

    // Address Fail-Safe
    let finalAddress = inputAddr;
    if (!finalAddress && customer && customer.address) {
      finalAddress = customer.address;
    }

    // 3. Create Order
    const order = new Order({
      branch: branchId,
      orderNumber: invoiceNo,
      orderType,
      customer: customer
        ? {
            name: customer.name,
            phone: customer.phone,
            id: customer._id,
          }
        : {
            name: (inputName && inputName.toLowerCase() !== 'guest') ? inputName : 'Guest',
            phone: hasValidPhone ? cleanPhone : customerPhone || 'N/A',
          },
      deliveryAddress: finalAddress,
      items,
      subtotal: safeNum(subtotal),
      discount: safeNum(discount),
      rewardCoinsUsed: safeNum(rewardCoinsUsed),
      rewardCoinsValue: safeNum(rewardCoinsValue),
      serviceCharge: safeNum(serviceCharge),
      deliveryCharge: safeNum(deliveryCharge),
      gstAmount: safeNum(gstAmount),
      grandTotal: safeNum(grandTotal),
      paymentMethod: paymentMethod || 'cash',
      rewardCoinsEarned,
      createdBy: req.user._id,
    });

    const createdOrder = await order.save();

    // 4. Realtime Broadcast
    const io = req.app.get('io');
    if (io) {
      io.emit('newOrder', createdOrder);
    }

    res.status(201).json({
      message: 'Order created successfully',
      order: createdOrder,
      customerData: customer,
    });
  } catch (error) {
    console.error('Create Order Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Lookup customer by phone (FLEXIBLE MATCH FOR ALL FORMATS)
// @route   GET /api/orders/customer/:phone
// @access  Private
const lookupCustomer = async (req, res) => {
  try {
    const rawPhone = req.params.phone ? req.params.phone.trim() : '';
    const cleanPhone = get10DigitPhone(rawPhone);

    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ message: 'Valid 10-digit phone number is required' });
    }

    const phoneRegex = buildPhoneRegex(cleanPhone);

    // 1. Find Customer Profile (By flexible phone regex)
    let customer = await Customer.findOne({
      $or: [
        { phone: phoneRegex },
        { phone: cleanPhone },
        { phone: { $regex: cleanPhone + '$' } }
      ]
    });

    // 2. Build multi-field search conditions for Order History
    const orderOrConditions = [
      { 'customer.phone': phoneRegex },
      { 'customerPhone': phoneRegex },
      { 'customer.phone': { $regex: cleanPhone + '$' } },
      { 'customerPhone': { $regex: cleanPhone + '$' } }
    ];

    if (customer && customer._id) {
      orderOrConditions.push({ 'customer.id': customer._id });
      orderOrConditions.push({ 'customer._id': customer._id });
    }

    // Fetch ALL orders matching phone or customer ID
    const allOrders = await Order.find({ $or: orderOrConditions }).sort({ createdAt: -1 });

    // Find real name from order history
    let realNameFromOrders = '';
    allOrders.forEach((o) => {
      const n = o.customer?.name || o.customerName || '';
      if (n && n.toLowerCase() !== 'guest' && !realNameFromOrders) {
        realNameFromOrders = n;
      }
    });

    // Valid Non-Cancelled Paid Orders for Stats
    const validOrders = allOrders.filter((o) => {
      const st = String(o.status || '').toLowerCase();
      const pay = String(o.paymentMethod || '').toLowerCase();
      if (['cancelled', 'canceled', 'cancel', 'rejected'].includes(st)) return false;
      if (pay === 'pending') return false;
      return true;
    });

    const computedOrdersCount = validOrders.length;
    const computedSpent = validOrders.reduce((sum, o) => sum + safeNum(o.grandTotal), 0);

    // Calculate Exact Coins Balance from History
    const computedCoinsBalance = validOrders.reduce((sum, o) => {
      const earned = (o.rewardCoinsEarned != null) ? safeNum(o.rewardCoinsEarned) : calculateEarnedCoins(o.grandTotal);
      const used = safeNum(o.rewardCoinsUsed);
      return sum + earned - used;
    }, 0);

    const exactCoins = Math.max(0, computedCoinsBalance);

    if (!customer) {
      if (allOrders.length === 0) {
        return res.json({ found: false });
      }
      customer = new Customer({
        phone: cleanPhone,
        name: realNameFromOrders || 'Guest',
        rewardCoins: exactCoins,
        totalOrders: computedOrdersCount,
        totalSpent: computedSpent,
      });
      await customer.save();
    } else {
      // Auto-heal DB customer record
      customer.phone = cleanPhone; // Normalize to 10 digits
      customer.rewardCoins = exactCoins;
      customer.totalOrders = computedOrdersCount;
      customer.totalSpent = computedSpent;

      if ((!customer.name || customer.name.toLowerCase() === 'guest') && realNameFromOrders) {
        customer.name = realNameFromOrders;
      }

      await customer.save();
    }

    const previousOrders = allOrders.slice(0, 10).map((o) => ({
      _id: o._id,
      orderNumber: o.orderNumber,
      grandTotal: safeNum(o.grandTotal),
      orderType: o.orderType,
      createdAt: o.createdAt,
      status: o.status,
      items: o.items,
      deliveryAddress: o.deliveryAddress,
      customer: o.customer,
    }));

    res.json({
      found: true,
      customer: {
        _id: customer._id,
        phone: customer.phone,
        name: customer.name || 'Guest',
        address: customer.address || '',
        rewardCoins: safeNum(customer.rewardCoins),
        totalOrders: safeNum(customer.totalOrders),
        totalSpent: safeNum(customer.totalSpent)
      },
      previousOrders,
    });
  } catch (error) {
    console.error('Lookup Error:', error);
    res.status(500).json({ message: error.message });
  }
};

const getOrders = async (req, res) => {
  try {
    const branchId = req.user?.branch?._id || req.user?.branch;
    const { status, today } = req.query;

    let filter = {};
    if (branchId) filter.branch = branchId;
    if (status) filter.status = status;

    if (today === 'true') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      filter.createdAt = { $gte: start };
    }

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name');

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { status, paymentMethod } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const oldPay = String(order.paymentMethod || '').toLowerCase();
    const newStatus = String(status || '').toLowerCase();

    order.status = status;
    if (paymentMethod) {
      order.paymentMethod = paymentMethod;
    }

    if (newStatus === 'completed') {
      order.completedAt = new Date();
    }

    // Finalize Coins on Dine-In Clear
    const phone = get10DigitPhone(order.customer?.phone);
    const shouldFinalizeCoins =
      newStatus === 'completed' &&
      oldPay === 'pending' &&
      phone.length === 10 &&
      safeNum(order.rewardCoinsEarned) === 0;

    if (shouldFinalizeCoins) {
      const earned = calculateEarnedCoins(order.grandTotal);
      order.rewardCoinsEarned = earned;

      const customer = await Customer.findOne({
        $or: [
          { phone: buildPhoneRegex(phone) },
          { phone: phone }
        ]
      });

      if (customer) {
        customer.rewardCoins = safeNum(customer.rewardCoins) + earned;
        customer.totalOrders = safeNum(customer.totalOrders) + 1;
        customer.totalSpent = safeNum(customer.totalSpent) + safeNum(order.grandTotal);
        await customer.save();
      }
    }

    await order.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('orderUpdated', order);
    }

    res.json({ message: 'Status updated', order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createOrder,
  lookupCustomer,
  getOrders,
  getOrderById,
  updateOrderStatus,
};