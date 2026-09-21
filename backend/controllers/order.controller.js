const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Branch = require('../models/Branch');
const { sendDirectWhatsAppMessage } = require('../helpers/whatsapp'); // WhatsApp API

// Safe Number Helper (Prevents NaN crashes)
const safeNum = (val) => {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

// Helper: Extract exact 10 digits
const get10DigitPhone = (p) => String(p || '').replace(/\D/g, '').slice(-10);

// Helper: ₹20 = 1 Coin (Change to /50 if you want)
const calculateEarnedCoins = (amount) => Math.floor(safeNum(amount) / 20);

// Build All Possible Phone Variants (String, Number, +91, 0, etc.)
const getPhoneVariants = (clean10Digits) => {
  if (!clean10Digits || clean10Digits.length < 10) return [];
  const numVal = Number(clean10Digits);
  return [
    clean10Digits,                // "9876543210" (String)
    numVal,                       // 9876543210 (Number Type for MongoDB bug)
    `+91${clean10Digits}`,        
    `91${clean10Digits}`,         
    `0${clean10Digits}`,          
    `+91 ${clean10Digits}`
  ];
};

// 1. CREATE ORDER
const createOrder = async (req, res) => {
  try {
    const {
      branch,
      orderType,
      customerPhone,
      customerName,
      customerAddress,
      deliveryAddress,
      items,
      subtotal,
      discount,
      rewardCoinsUsed,
      rewardCoinsValue,
      serviceCharge,
      deliveryCharge,
      gstAmount,
      grandTotal,
      paymentMethod,
    } = req.body;

    // Generate Order Number
    const count = await Order.countDocuments().catch(() => 0);
    const orderNumber = `ORD-${101 + count}`;

    const safeGrandTotal = safeNum(grandTotal);
    const payMethod = String(paymentMethod || 'cash').toLowerCase().trim();
    const isPendingPayment = payMethod === 'pending';
    
    let cleanPhone = get10DigitPhone(customerPhone);
    if (cleanPhone.length !== 10) cleanPhone = 'N/A';

    let customerObj = { name: customerName || 'Guest', phone: cleanPhone };
    let rewardCoinsEarned = 0;

    if (cleanPhone !== 'N/A') {
      const finalAddress = (customerAddress || deliveryAddress || '').trim();
      const phoneVariants = getPhoneVariants(cleanPhone);

      // Smart Search: Both String and Number types
      let existingCustomer = await Customer.findOne({
        $or: [
          { phone: { $in: phoneVariants } },
          { phone: { $regex: cleanPhone + '$', $options: 'i' } }
        ]
      });

      // Deduct Used Coins Safely
      let coinsToRedeem = safeNum(rewardCoinsUsed);
      if (existingCustomer && coinsToRedeem > 0) {
        let currentBalance = safeNum(existingCustomer.rewardCoins);
        if (currentBalance < coinsToRedeem) {
          coinsToRedeem = Math.floor(currentBalance / 20) * 20;
        }
        existingCustomer.rewardCoins = Math.max(0, currentBalance - coinsToRedeem);
      }

      // Earn Coins (Only if not a pending table start)
      if (!isPendingPayment) {
        rewardCoinsEarned = calculateEarnedCoins(safeGrandTotal);
      }

      if (existingCustomer) {
        existingCustomer.phone = cleanPhone; // Normalize
        if (customerName && customerName.toLowerCase() !== 'guest') existingCustomer.name = customerName;
        if (finalAddress) existingCustomer.address = finalAddress;
        
        if (!isPendingPayment) {
          existingCustomer.totalOrders = safeNum(existingCustomer.totalOrders) + 1;
          existingCustomer.totalSpent = safeNum(existingCustomer.totalSpent) + safeGrandTotal;
          existingCustomer.rewardCoins = safeNum(existingCustomer.rewardCoins) + rewardCoinsEarned;
        }

        await existingCustomer.save();
        customerObj = { id: existingCustomer._id, name: existingCustomer.name, phone: existingCustomer.phone };
      } else {
        const newCust = await Customer.create({
          phone: cleanPhone,
          name: (customerName && customerName.toLowerCase() !== 'guest') ? customerName : 'Guest',
          address: finalAddress,
          totalOrders: isPendingPayment ? 0 : 1,
          totalSpent: isPendingPayment ? 0 : safeGrandTotal,
          rewardCoins: rewardCoinsEarned,
        });
        customerObj = { id: newCust._id, name: newCust.name, phone: newCust.phone };
      }
    }

    const safeOrderType = ['delivery', 'takeaway', 'dine-in'].includes(String(orderType).toLowerCase()) 
      ? String(orderType).toLowerCase() : 'dine-in';

    const newOrder = new Order({
      branch: branch || null,
      orderNumber,
      orderType: safeOrderType,
      customer: customerObj,
      customerPhone: cleanPhone,
      deliveryAddress: deliveryAddress || customerAddress || '',
      items: items || [],
      subtotal: safeNum(subtotal),
      discount: safeNum(discount),
      rewardCoinsUsed: safeNum(rewardCoinsUsed),
      rewardCoinsValue: safeNum(rewardCoinsValue),
      rewardCoinsEarned,
      serviceCharge: safeNum(serviceCharge),
      deliveryCharge: safeNum(deliveryCharge),
      gstAmount: safeNum(gstAmount),
      grandTotal: safeGrandTotal,
      paymentMethod: payMethod,
      paymentStatus: isPendingPayment ? 'pending' : 'paid',
      status: 'new',
    });

    await newOrder.save();

    // 🔥 AUTOMATIC WHATSAPP VIA POWERSTEXT API
    if (cleanPhone !== 'N/A' && !isPendingPayment) {
      sendDirectWhatsAppMessage(cleanPhone, newOrder);
    }

    const io = req.app.get('io');
    if (io) io.emit('newOrder', newOrder);

    return res.status(201).json({ success: true, order: newOrder, customerData: customerObj });
  } catch (err) {
    console.error('❌ ORDER CREATION ERROR:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// 2. LOOKUP CUSTOMER (AUTO HEAL & SYNC)
const lookupCustomer = async (req, res) => {
  try {
    const cleanPhone = get10DigitPhone(req.params.phone);
    if (cleanPhone.length < 10) return res.status(400).json({ message: 'Valid 10-digit phone required' });

    const phoneVariants = getPhoneVariants(cleanPhone);

    // Find Profile
    let customer = await Customer.findOne({
      $or: [
        { phone: { $in: phoneVariants } },
        { phone: { $regex: cleanPhone + '$', $options: 'i' } }
      ]
    });

    // Find ALL Order History using robust multi-field match
    const orderOrConditions = [
      { 'customer.phone': { $in: phoneVariants } },
      { 'customerPhone': { $in: phoneVariants } },
      { 'customer.phone': { $regex: cleanPhone + '$', $options: 'i' } },
      { 'customerPhone': { $regex: cleanPhone + '$', $options: 'i' } }
    ];
    if (customer && customer._id) {
      orderOrConditions.push({ 'customer.id': customer._id });
      orderOrConditions.push({ 'customer._id': customer._id });
    }

    const allOrders = await Order.find({ $or: orderOrConditions }).sort({ createdAt: -1 }).lean();

    let realName = '';
    allOrders.forEach(o => {
      const n = o.customer?.name || o.customerName || '';
      if (n && n.toLowerCase() !== 'guest' && !realName) realName = n;
    });

    const validOrders = allOrders.filter(o => {
      const st = String(o.status || '').toLowerCase();
      const pay = String(o.paymentMethod || '').toLowerCase();
      return !['cancelled', 'canceled', 'cancel', 'rejected'].includes(st) && pay !== 'pending';
    });

    const computedOrders = validOrders.length;
    const computedSpent = validOrders.reduce((sum, o) => sum + safeNum(o.grandTotal), 0);
    const computedCoins = Math.max(0, validOrders.reduce((sum, o) => {
      const earned = o.rewardCoinsEarned != null ? safeNum(o.rewardCoinsEarned) : calculateEarnedCoins(o.grandTotal);
      return sum + earned - safeNum(o.rewardCoinsUsed);
    }, 0));

    if (!customer) {
      if (allOrders.length === 0) return res.json({ found: false });
      customer = await Customer.create({
        phone: cleanPhone, name: realName || 'Guest', rewardCoins: computedCoins, totalOrders: computedOrders, totalSpent: computedSpent
      });
    } else {
      customer.phone = cleanPhone;
      customer.rewardCoins = computedCoins;
      customer.totalOrders = computedOrders;
      customer.totalSpent = computedSpent;
      if ((!customer.name || customer.name.toLowerCase() === 'guest') && realName) customer.name = realName;
      await customer.save();
    }

    return res.json({
      found: true,
      customer: { _id: customer._id, phone: customer.phone, name: customer.name || 'Guest', address: customer.address || '', rewardCoins: safeNum(customer.rewardCoins), totalOrders: safeNum(customer.totalOrders), totalSpent: safeNum(customer.totalSpent) },
      previousOrders: allOrders.slice(0, 5),
    });
  } catch (err) {
    return res.status(500).json({ found: false, message: err.message });
  }
};

// 3. GET ORDERS
const getOrders = async (req, res) => {
  try {
    const { today, status } = req.query;
    let query = {};
    if (status) query.status = status;
    if (today === 'true') {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      query.createdAt = { $gte: startOfDay };
    }
    const orders = await Order.find(query).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 4. GET SINGLE ORDER
const getOrderById = async (req, res) => {
  try {
    if (req.params.id.length !== 24) return res.status(400).json({ message: 'Invalid ID' });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 5. UPDATE STATUS & FINALIZE DINE-IN COINS
const updateOrderStatus = async (req, res) => {
  try {
    const { status, paymentMethod } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const oldPay = String(order.paymentMethod || '').toLowerCase();
    const newStatus = String(status || '').toLowerCase();

    order.status = status;
    if (paymentMethod) order.paymentMethod = paymentMethod;
    if (newStatus === 'completed') order.completedAt = new Date();

    // Finalize Coins if Dine-In (Pending -> Completed)
    const phone = get10DigitPhone(order.customer?.phone || order.customerPhone);
    if (newStatus === 'completed' && oldPay === 'pending' && phone.length === 10 && safeNum(order.rewardCoinsEarned) === 0) {
      const earned = calculateEarnedCoins(order.grandTotal);
      order.rewardCoinsEarned = earned;
      const cust = await Customer.findOne({ phone: { $regex: phone + '$' } });
      if (cust) {
        cust.rewardCoins = safeNum(cust.rewardCoins) + earned;
        cust.totalOrders = safeNum(cust.totalOrders) + 1;
        cust.totalSpent = safeNum(cust.totalSpent) + safeNum(order.grandTotal);
        await cust.save();
      }
    }

    await order.save();
    const io = req.app.get('io');
    if (io) io.emit('orderUpdated', order);

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 6. ADD KOT ITEMS (For Dine-in)
const addKotItems = async (req, res) => {
  try {
    const { items, subtotal, grandTotal } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.items.push(...items);
    order.subtotal = safeNum(order.subtotal) + safeNum(subtotal);
    order.grandTotal = safeNum(order.grandTotal) + safeNum(grandTotal);
    await order.save();

    const io = req.app.get('io');
    if (io) io.emit('orderUpdated', order);

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createOrder,
  lookupCustomer,
  getOrders,
  getOrderById,
  updateOrderStatus,
  addKotItems
};