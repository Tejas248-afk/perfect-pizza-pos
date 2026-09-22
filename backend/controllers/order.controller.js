const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Branch = require('../models/Branch');
const { sendDirectWhatsAppMessage } = require('../helpers/whatsapp');

// Safe Number Helper
const safeNum = (val) => {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

// Helper: Extract clean 10 digits
const get10DigitPhone = (p) => String(p || '').replace(/\D/g, '').slice(-10);

// Rule: ₹20 spent = 1 Coin
const calculateEarnedCoins = (amount) => Math.floor(safeNum(amount) / 20);

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
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
      status
    } = req.body;

    const branchId = branch || req.user?.branch?._id || req.user?.branch;

    // 1. Order Number Generation
    const count = await Order.countDocuments().catch(() => 0);
    const orderNumber = `ORD-${101 + count}`;

    const safeGrandTotal = safeNum(grandTotal);
    const payMethod = String(paymentMethod || 'cash').toLowerCase().trim();
    const initialStatus = String(status || 'new').toLowerCase().trim();
    
    let cleanPhone = get10DigitPhone(customerPhone);
    if (cleanPhone.length !== 10) cleanPhone = 'N/A';

    let customerObj = { name: customerName || 'Guest', phone: cleanPhone };
    const rewardCoinsEarned = calculateEarnedCoins(safeGrandTotal);
    let coinsAwarded = false;

    if (cleanPhone !== 'N/A') {
      const finalAddress = String(customerAddress || deliveryAddress || '').trim();

      // Find Customer Profile
      let customer = await Customer.findOne({
        $or: [
          { phone: cleanPhone },
          { phone: { $regex: cleanPhone + '$', $options: 'i' } }
        ]
      });

      // Deduct Used Coins immediately
      let coinsToRedeem = safeNum(rewardCoinsUsed);
      if (customer && coinsToRedeem > 0) {
        let currentBalance = safeNum(customer.rewardCoins);
        if (currentBalance < coinsToRedeem) {
          coinsToRedeem = Math.floor(currentBalance / 20) * 20;
        }
        customer.rewardCoins = Math.max(0, currentBalance - coinsToRedeem);
      }

      if (!customer) {
        try {
          customer = await Customer.create({
            branch: branchId,
            phone: cleanPhone,
            name: (customerName && customerName.toLowerCase() !== 'guest') ? customerName : 'Guest',
            address: finalAddress,
            rewardCoins: 0,
            totalOrders: 0,
            totalSpent: 0
          });
        } catch (e) {
          customer = await Customer.findOne({ phone: { $regex: cleanPhone + '$', $options: 'i' } });
        }
      } else {
        customer.phone = cleanPhone;
        if (branchId && !customer.branch) customer.branch = branchId;
        if (customerName && customerName.toLowerCase() !== 'guest') customer.name = customerName;
        if (finalAddress) customer.address = finalAddress;
      }

      // If order is placed directly as "completed"
      if (initialStatus === 'completed') {
        customer.rewardCoins = safeNum(customer.rewardCoins) + rewardCoinsEarned;
        customer.totalOrders = safeNum(customer.totalOrders) + 1;
        customer.totalSpent = safeNum(customer.totalSpent) + safeGrandTotal;
        coinsAwarded = true;
      }

      if (customer) {
        if (branchId && !customer.branch) customer.branch = branchId;
        await customer.save().catch(err => console.error("⚠️ Customer save warning:", err.message));
        customerObj = { id: customer._id, _id: customer._id, name: customer.name, phone: cleanPhone };
      }
    }

    const safeOrderType = ['delivery', 'takeaway', 'dine-in'].includes(String(orderType).toLowerCase()) 
      ? String(orderType).toLowerCase() : 'dine-in';

    const newOrder = new Order({
      branch: branchId || null,
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
      coinsAwarded,
      serviceCharge: safeNum(serviceCharge),
      deliveryCharge: safeNum(deliveryCharge),
      gstAmount: safeNum(gstAmount),
      grandTotal: safeGrandTotal,
      paymentMethod: payMethod,
      paymentStatus: payMethod === 'pending' ? 'pending' : 'paid',
      status: initialStatus,
    });

    await newOrder.save();

    // Direct WhatsApp Notification
    if (cleanPhone !== 'N/A' && payMethod !== 'pending') {
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

// @desc    Lookup customer by phone
// @route   GET /api/orders/customer/:phone
// @access  Private
const lookupCustomer = async (req, res) => {
  try {
    const cleanPhone = get10DigitPhone(req.params.phone);
    if (cleanPhone.length < 10) return res.status(400).json({ found: false, message: 'Valid 10-digit phone required' });

    const branchId = req.user?.branch?._id || req.user?.branch;

    // 1. Search Customer Profile
    let customer = await Customer.findOne({
      $or: [
        { phone: cleanPhone },
        { phone: { $regex: cleanPhone + '$', $options: 'i' } }
      ]
    });

    // 2. Search ALL Orders in History
    const orderOrConditions = [
      { 'customer.phone': cleanPhone },
      { 'customerPhone': cleanPhone },
      { 'phone': cleanPhone },
      { 'customer.phone': { $regex: cleanPhone + '$', $options: 'i' } },
      { 'customerPhone': { $regex: cleanPhone + '$', $options: 'i' } },
      { 'phone': { $regex: cleanPhone + '$', $options: 'i' } }
    ];

    if (customer && customer._id) {
      orderOrConditions.push({ 'customer.id': customer._id });
      orderOrConditions.push({ 'customer._id': customer._id });
      orderOrConditions.push({ 'customer': customer._id });
    }

    const allOrders = await Order.find({ $or: orderOrConditions }).sort({ createdAt: -1 }).lean();

    // Extract real name
    let realName = '';
    allOrders.forEach(o => {
      const n = o.customer?.name || o.customerName || '';
      if (n && n.toLowerCase() !== 'guest' && !realName) realName = n;
    });

    // Completed Orders
    const completedOrders = allOrders.filter(o => String(o.status || '').toLowerCase() === 'completed');
    
    // Non-Cancelled Orders
    const nonCancelledOrders = allOrders.filter(o => !['cancelled', 'canceled', 'cancel', 'rejected'].includes(String(o.status || '').toLowerCase()));

    const computedOrders = completedOrders.length;
    const computedSpent = completedOrders.reduce((sum, o) => sum + safeNum(o.grandTotal), 0);

    // Coins Calculation
    const earnedCoins = completedOrders.reduce((sum, o) => {
      return sum + (o.rewardCoinsEarned != null ? safeNum(o.rewardCoinsEarned) : calculateEarnedCoins(o.grandTotal));
    }, 0);

    const usedCoins = nonCancelledOrders.reduce((sum, o) => sum + safeNum(o.rewardCoinsUsed), 0);
    const computedCoins = Math.max(0, earnedCoins - usedCoins);

    // AUTO-RECOVERY & SYNC
    if (!customer) {
      if (allOrders.length === 0) return res.json({ found: false });
      
      try {
        customer = await Customer.create({
          branch: branchId,
          phone: cleanPhone,
          name: realName || 'Guest',
          rewardCoins: computedCoins,
          totalOrders: computedOrders,
          totalSpent: computedSpent
        });
      } catch (e) {
        customer = await Customer.findOne({ phone: { $regex: cleanPhone + '$', $options: 'i' } });
      }
    } else {
      customer.phone = cleanPhone;
      if (branchId && !customer.branch) customer.branch = branchId;
      customer.rewardCoins = computedCoins;
      customer.totalOrders = computedOrders;
      customer.totalSpent = computedSpent;
      if ((!customer.name || customer.name.toLowerCase() === 'guest') && realName) {
        customer.name = realName;
      }
      await customer.save().catch(e => console.error("Customer heal save error:", e.message));
    }

    return res.json({
      found: true,
      customer: {
        _id: customer ? customer._id : null,
        phone: cleanPhone,
        name: customer?.name || realName || 'Guest',
        address: customer?.address || '',
        rewardCoins: customer ? safeNum(customer.rewardCoins) : computedCoins,
        totalOrders: customer ? safeNum(customer.totalOrders) : computedOrders,
        totalSpent: customer ? safeNum(customer.totalSpent) : computedSpent
      },
      previousOrders: allOrders.slice(0, 10),
    });
  } catch (err) {
    console.error('Lookup error:', err);
    return res.status(500).json({ found: false, message: err.message });
  }
};

// @desc    Get Orders
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

// @desc    Get Single Order
const getOrderById = async (req, res) => {
  try {
    if (!req.params.id || req.params.id.length !== 24) return res.status(400).json({ message: 'Invalid ID' });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Update Status & Award Coins (FAIL-SAFE)
const updateOrderStatus = async (req, res) => {
  try {
    const { status, paymentMethod } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const newStatus = String(status || '').toLowerCase().trim();

    order.status = status;
    if (paymentMethod) order.paymentMethod = paymentMethod;
    if (newStatus === 'completed') order.completedAt = new Date();

    const cleanPhone = get10DigitPhone(order.customer?.phone || order.customerPhone);
    const branchId = order.branch || req.user?.branch?._id || req.user?.branch;

    // 🪙 AWARD COINS WHEN ORDER BECOMES COMPLETED (ALL TYPES)
    if (newStatus === 'completed' && !order.coinsAwarded && cleanPhone.length === 10) {
      const earned = order.rewardCoinsEarned != null ? safeNum(order.rewardCoinsEarned) : calculateEarnedCoins(order.grandTotal);
      order.rewardCoinsEarned = earned;
      order.coinsAwarded = true;

      try {
        const cust = await Customer.findOne({
          $or: [
            { phone: cleanPhone },
            { phone: { $regex: cleanPhone + '$', $options: 'i' } }
          ]
        });

        if (cust) {
          if (branchId && !cust.branch) cust.branch = branchId; // 🔥 Fix missing branch error
          cust.rewardCoins = safeNum(cust.rewardCoins) + earned;
          cust.totalOrders = safeNum(cust.totalOrders) + 1;
          cust.totalSpent = safeNum(cust.totalSpent) + safeNum(order.grandTotal);
          await cust.save();
          console.log(`🪙 COINS AWARDED | Phone: ${cleanPhone} | +${earned} Coins | Total: ${cust.rewardCoins}`);
        }
      } catch (custErr) {
        console.error("⚠️ Customer coins update error (non-blocking):", custErr.message);
      }
    }

    // 🔴 IF ORDER CANCELLED: Revert awarded coins & refund used coins
    if (['cancelled', 'canceled', 'rejected'].includes(newStatus)) {
      try {
        const cust = await Customer.findOne({
          $or: [
            { phone: cleanPhone },
            { phone: { $regex: cleanPhone + '$', $options: 'i' } }
          ]
        });

        if (cust) {
          if (branchId && !cust.branch) cust.branch = branchId; // 🔥 Fix missing branch error
          
          if (order.coinsAwarded) {
            cust.rewardCoins = Math.max(0, safeNum(cust.rewardCoins) - safeNum(order.rewardCoinsEarned));
            cust.totalOrders = Math.max(0, safeNum(cust.totalOrders) - 1);
            cust.totalSpent = Math.max(0, safeNum(cust.totalSpent) - safeNum(order.grandTotal));
            order.coinsAwarded = false;
          }

          if (safeNum(order.rewardCoinsUsed) > 0) {
            cust.rewardCoins = safeNum(cust.rewardCoins) + safeNum(order.rewardCoinsUsed);
          }

          await cust.save();
        }
      } catch (custErr) {
        console.error("⚠️ Customer cancel refund error (non-blocking):", custErr.message);
      }
    }

    await order.save();
    const io = req.app.get('io');
    if (io) io.emit('orderUpdated', order);

    res.json({ success: true, order });
  } catch (err) {
    console.error("Update status error:", err);
    res.status(500).json({ message: err.message });
  }
};

// @desc    Add KOT Items (Dine-in)
const addKotItems = async (req, res) => {
  try {
    const { items, subtotal, grandTotal } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.items.push(...items);
    order.subtotal = safeNum(order.subtotal) + safeNum(subtotal);
    order.grandTotal = safeNum(order.grandTotal) + safeNum(grandTotal);
    
    order.rewardCoinsEarned = calculateEarnedCoins(order.grandTotal);

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
// 🔥 AUTO WHATSAPP INVOICE
if (cleanPhone !== 'N/A' && String(payMethod).toLowerCase() !== 'pending') {
  // fire-and-forget (order response delay na ho)
  setImmediate(() => {
    sendDirectWhatsAppMessage(cleanPhone, newOrder);
  });
}