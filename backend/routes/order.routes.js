const express = require('express');
const router = express.Router();

// Models
const Order = require('../models/Order');
const Customer = require('../models/Customer');

// 1. GET Customer Lookup by Phone
router.get('/customer/:phone', async (req, res) => {
  try {
    let phone = String(req.params.phone || '').replace(/[^0-9]/g, '');
    if (phone.length >= 10) phone = phone.slice(-10);

    const customer = await Customer.findOne({ phone });
    if (!customer) {
      return res.json({ found: false });
    }

    const previousOrders = await Order.find({
      $or: [
        { 'customer.phone': phone },
        { customerPhone: phone },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(5);

    return res.json({
      found: true,
      customer: {
        _id: customer._id,
        phone: customer.phone,
        name: customer.name || 'Guest',
        address: customer.address || '',
        rewardCoins: customer.rewardCoins || 0,
        totalOrders: customer.totalOrders || 0,
        totalSpent: customer.totalSpent || 0,
      },
      previousOrders,
    });
  } catch (err) {
    console.error("Customer Lookup Error:", err);
    return res.status(500).json({ found: false, message: err.message });
  }
});

// 2. GET All Orders (Today's Orders)
router.get('/', async (req, res) => {
  try {
    const { today } = req.query;
    let query = {};

    if (today === 'true') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    const orders = await Order.find(query).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error("Get Orders Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// 3. GET Single Order by ID
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 4. POST Create New Order (CRASH PROOF & SANITIZED)
router.post('/', async (req, res) => {
  try {
    const {
      orderType,
      customerPhone,
      customerName,
      deliveryAddress,
      customerAddress,
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

    // 🔥 DATA SANITIZER: Frontend ke bade objects ko clean format me lana
    const sanitizedItems = (items || []).map(item => {
      const productId = item.product?._id || (typeof item.product === 'string' ? item.product : null);
      const productName = item.product?.name || item.productName || 'Item';
      
      let crustData = null;
      if (item.crust) {
        if (typeof item.crust === 'object') {
          crustData = { _id: item.crust._id, name: item.crust.name };
        } else {
          crustData = { name: String(item.crust) };
        }
      }

      const addonsData = (item.addons || []).map(a => {
        if (typeof a === 'object') return { _id: a._id, name: a.name };
        return { name: String(a) };
      });

      return {
        product: productId,
        productName: productName,
        size: item.size || 'single',
        crust: crustData,
        crustPrice: Number(item.crustPrice) || 0,
        addons: addonsData,
        addonsTotal: Number(item.addonsTotal) || 0,
        qty: Number(item.qty) || 1,
        basePrice: Number(item.basePrice) || 0,
        comboSelections: item.comboSelections || []
      };
    });

    // Order Number Generate Karein
    const count = await Order.countDocuments();
    const orderNumber = `ORD-${101 + count}`;

    // Reward Coins Calculate Karein (₹50 = 1 coin)
    const rewardCoinsEarned = Math.floor((grandTotal || 0) / 50);

    // Save/Update Customer Info
    let customerData = { name: 'Guest', phone: 'N/A' };
    if (customerPhone && customerPhone.length >= 10) {
      const cleanPhone = customerPhone.replace(/[^0-9]/g, '').slice(-10);
      const finalAddress = customerAddress || deliveryAddress || '';

      let customer = await Customer.findOne({ phone: cleanPhone });
      if (customer) {
        customer.name = customerName || customer.name;
        if (finalAddress) customer.address = finalAddress;
        customer.totalOrders = (customer.totalOrders || 0) + 1;
        customer.totalSpent = (customer.totalSpent || 0) + (grandTotal || 0);
        customer.rewardCoins = Math.max(0, (customer.rewardCoins || 0) - (rewardCoinsUsed || 0) + rewardCoinsEarned);
        await customer.save();
      } else {
        customer = await Customer.create({
          phone: cleanPhone,
          name: customerName || 'Guest',
          address: finalAddress,
          totalOrders: 1,
          totalSpent: grandTotal || 0,
          rewardCoins: rewardCoinsEarned,
        });
      }

      customerData = {
        _id: customer._id,
        phone: customer.phone,
        name: customer.name,
        rewardCoins: customer.rewardCoins,
      };
    }

    const newOrder = new Order({
      orderNumber,
      orderType: orderType || 'dine-in',
      customer: customerData,
      customerPhone: customerPhone || 'N/A',
      deliveryAddress: deliveryAddress || '',
      items: sanitizedItems,
      subtotal: Number(subtotal) || 0,
      discount: Number(discount) || 0,
      rewardCoinsUsed: Number(rewardCoinsUsed) || 0,
      rewardCoinsValue: Number(rewardCoinsValue) || 0,
      rewardCoinsEarned,
      serviceCharge: Number(serviceCharge) || 0,
      deliveryCharge: Number(deliveryCharge) || 0,
      gstAmount: Number(gstAmount) || 0,
      grandTotal: Number(grandTotal) || 0,
      paymentMethod: paymentMethod || 'cash',
      status: 'new',
    });

    await newOrder.save();

    // Socket Emit to Live Screens & Kitchen
    const io = req.app.get('io');
    if (io) {
      io.emit('newOrder', newOrder);
    }

    res.status(201).json({ success: true, order: newOrder, customerData });
  } catch (err) {
    console.error("❌ CREATE ORDER ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. PATCH Update Order Status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!order) return res.status(404).json({ message: 'Order not found' });

    const io = req.app.get('io');
    if (io) {
      io.emit('orderUpdated', order);
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 6. PATCH Add KOT Items to Existing Order (Dine-in)
router.patch('/:id/add-items', async (req, res) => {
  try {
    const { items, subtotal, grandTotal } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.items.push(...items);
    order.subtotal = (order.subtotal || 0) + subtotal;
    order.grandTotal = (order.grandTotal || 0) + grandTotal;
    await order.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('orderUpdated', order);
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;