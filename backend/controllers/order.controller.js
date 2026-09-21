const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Branch = require('../models/Branch');

// ✅ Same rule for dine-in / delivery / takeaway
// ₹20 spent = 1 coin
const calculateEarnedCoins = (amount) => Math.floor((Number(amount) || 0) / 20);

const cleanPhoneNumber = (phone) =>
  String(phone || '').replace(/[^0-9]/g, '').slice(-10);

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
    const type = String(orderType || '').toLowerCase().trim(); // dine-in | delivery | takeaway
    const payMethod = String(paymentMethod || 'cash').toLowerCase().trim();

    // 1. Generate Invoice Number
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return res.status(404).json({ message: 'Branch not found' });
    }

    const invoiceNo = `${branch.invoicePrefix}${branch.currentInvoiceNumber}`;
    branch.currentInvoiceNumber += 1;
    await branch.save();

    // 2. Customer + Coins (ALL order types)
    let customer = null;
    let rewardCoinsEarned = 0;

    const cleanPhone = cleanPhoneNumber(customerPhone);
    const hasValidPhone = cleanPhone.length === 10;
    const inputName = customerName ? String(customerName).trim() : '';
    const inputAddr = String(deliveryAddress || customerAddress || '').trim();

    // pending = table start KOT (final bill baad me) -> coins mat do abhi
    const isPendingPayment = payMethod === 'pending';

    if (hasValidPhone) {
      customer = await Customer.findOne({ phone: cleanPhone });

      if (!customer) {
        customer = new Customer({
          branch: branchId,
          phone: cleanPhone,
          name:
            inputName && inputName.toLowerCase() !== 'guest'
              ? inputName
              : 'Guest',
          address: inputAddr,
          rewardCoins: 0,
          totalOrders: 0,
          totalSpent: 0,
        });
      } else {
        if (inputName && inputName.toLowerCase() !== 'guest') {
          customer.name = inputName;
        }
        if (inputAddr) {
          customer.address = inputAddr;
        }
      }

      // Redeem coins (if any)
      const coinsToRedeem = Number(rewardCoinsUsed) || 0;
      if (coinsToRedeem > 0) {
        const currentBalance = Number(customer.rewardCoins) || 0;
        if (currentBalance < coinsToRedeem) {
          return res.status(400).json({ message: 'Not enough reward coins' });
        }
        // POS multiples of 20 use karta hai
        if (coinsToRedeem % 20 !== 0) {
          return res
            .status(400)
            .json({ message: 'Coins must be redeemed in multiples of 20' });
        }
        customer.rewardCoins = currentBalance - coinsToRedeem;
      }

      // ✅ Earn coins for dine-in + delivery + takeaway
      // only when bill is actual payment (not pending table open)
      if (!isPendingPayment) {
        rewardCoinsEarned = calculateEarnedCoins(grandTotal);
        customer.rewardCoins =
          (Number(customer.rewardCoins) || 0) + rewardCoinsEarned;
        customer.totalOrders = (Number(customer.totalOrders) || 0) + 1;
        customer.totalSpent =
          (Number(customer.totalSpent) || 0) + Number(grandTotal || 0);
      }

      await customer.save();

      console.log(
        `🪙 COINS | type=${type || 'n/a'} | pay=${payMethod} | phone=${cleanPhone} | earned=+${rewardCoinsEarned} | balance=${customer.rewardCoins}`
      );
    } else {
      // No phone = Guest = no coins (any type)
      rewardCoinsEarned = 0;
    }

    // Address fail-safe
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
            name:
              inputName && inputName.toLowerCase() !== 'guest'
                ? inputName
                : 'Guest',
            phone: hasValidPhone ? cleanPhone : customerPhone || 'N/A',
          },
      deliveryAddress: finalAddress,
      items,
      subtotal: Number(subtotal) || 0,
      discount: Number(discount) || 0,
      rewardCoinsUsed: Number(rewardCoinsUsed) || 0,
      rewardCoinsValue: Number(rewardCoinsValue) || 0,
      serviceCharge: Number(serviceCharge) || 0,
      deliveryCharge: Number(deliveryCharge) || 0,
      gstAmount: Number(gstAmount) || 0,
      grandTotal: Number(grandTotal) || 0,
      paymentMethod: paymentMethod || 'cash',
      rewardCoinsEarned,
      createdBy: req.user._id,
    });

    const createdOrder = await order.save();

    // 4. Realtime
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

// @desc    Lookup customer by phone (AUTO RE-CALCULATE COINS BALANCE)
// @route   GET /api/orders/customer/:phone
// @access  Private
const lookupCustomer = async (req, res) => {
  try {
    const rawPhone = req.params.phone ? req.params.phone.trim() : '';
    const cleanPhone = cleanPhoneNumber(rawPhone);

    if (!cleanPhone || cleanPhone.length < 10) {
      return res
        .status(400)
        .json({ message: 'Valid 10-digit phone number is required' });
    }

    const allOrders = await Order.find({
      $or: [{ 'customer.phone': cleanPhone }, { 'customer.phone': rawPhone }],
    }).sort({ createdAt: -1 });

    let customer = await Customer.findOne({ phone: cleanPhone });

    // Real name from history
    let realNameFromOrders = '';
    allOrders.forEach((o) => {
      const n = o.customer?.name || o.customerName || '';
      if (n && n.toLowerCase() !== 'guest' && !realNameFromOrders) {
        realNameFromOrders = n;
      }
    });

    // Only count paid/non-cancelled orders for stats
    const nonCancelled = allOrders.filter((o) => {
      const st = String(o.status || '').toLowerCase();
      const pay = String(o.paymentMethod || '').toLowerCase();
      if (['cancelled', 'canceled', 'cancel', 'rejected'].includes(st)) return false;
      // pending table open orders ko stats se hatao
      if (pay === 'pending') return false;
      return true;
    });

    const computedOrdersCount = nonCancelled.length;
    const computedSpent = nonCancelled.reduce(
      (sum, o) => sum + (Number(o.grandTotal) || 0),
      0
    );

    const computedCoinsBalance = nonCancelled.reduce((sum, o) => {
      const earned =
        o.rewardCoinsEarned != null
          ? Number(o.rewardCoinsEarned)
          : calculateEarnedCoins(o.grandTotal);
      const used = Number(o.rewardCoinsUsed) || 0;
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
      customer.rewardCoins = exactCoins;
      customer.totalOrders = computedOrdersCount;
      customer.totalSpent = computedSpent;

      if (
        (!customer.name || customer.name.toLowerCase() === 'guest') &&
        realNameFromOrders
      ) {
        customer.name = realNameFromOrders;
      }

      await customer.save();
    }

    const previousOrders = allOrders.slice(0, 5).map((o) => ({
      _id: o._id,
      orderNumber: o.orderNumber,
      grandTotal: o.grandTotal,
      orderType: o.orderType,
      createdAt: o.createdAt,
      status: o.status,
      items: o.items,
      deliveryAddress: o.deliveryAddress,
      customer: o.customer,
    }));

    res.json({
      found: true,
      customer,
      previousOrders,
    });
  } catch (error) {
    console.error('Lookup Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get orders
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

// @desc    Get order by ID
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update order status
// when completed + was pending -> finalize coins (dine-in final bill support)
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

    // ✅ Dine-in finalization:
    // agar pehle pending tha aur ab completed + phone hai + coins abhi 0 hain
    // to ab coins add kar do
    const phone = cleanPhoneNumber(order.customer?.phone);
    const shouldFinalizeCoins =
      newStatus === 'completed' &&
      oldPay === 'pending' &&
      phone.length === 10 &&
      (Number(order.rewardCoinsEarned) || 0) === 0;

    if (shouldFinalizeCoins) {
      const earned = calculateEarnedCoins(order.grandTotal);
      order.rewardCoinsEarned = earned;

      const customer = await Customer.findOne({ phone });
      if (customer) {
        customer.rewardCoins = (Number(customer.rewardCoins) || 0) + earned;
        customer.totalOrders = (Number(customer.totalOrders) || 0) + 1;
        customer.totalSpent =
          (Number(customer.totalSpent) || 0) + Number(order.grandTotal || 0);
        await customer.save();

        console.log(
          `🪙 FINALIZE DINE-IN COINS | phone=${phone} | earned=+${earned} | balance=${customer.rewardCoins}`
        );
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