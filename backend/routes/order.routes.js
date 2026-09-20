const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Models
const Order = require('../models/Order');
const Customer = require('../models/Customer');

// Helper to check valid MongoDB ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

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

// 4. POST Create New Order (SUPER SAFE & DETAILED ERROR LOGGING)
router.post('/', async (req, res) => {
  try {
    console.log("📥 Incoming Order Body:", JSON.stringify(req.body, null, 2));

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

    // --- SANITIZE ITEMS ---
    const sanitizedItems = (items || []).map((item) => {
      let rawProdId = item.product?._id || (typeof item.product === 'string' ? item.product : null);
      let validProdId = (rawProdId && isValidObjectId(rawProdId)) ? rawProdId : new mongoose.Types.ObjectId();
      let pName = item.product?.name || item.productName || 'Item';

      let crustData = null;
      if (item.crust) {
        let crustName = typeof item.crust === 'object' ? (item.crust.name || '') : String(item.crust);
        if (crustName) crustData = { name: crustName };
      }

      let addonsList = (item.addons || []).map((a) => {
        if (typeof a === 'object') return { name: a.name || '' };
        return { name: String(a) };
      });

      return {
        product: validProdId,
        productName: pName,
        size: item.size || 'regular',
        crust: crustData,
        crustPrice: Number(item.crustPrice) || 0,
        addons: addonsList,
        addonsTotal: Number(item.addonsTotal) || 0,
        qty: Number(item.qty) || 1,
        basePrice: Number(item.basePrice) || 0,
        comboSelections: Array.isArray(item.comboSelections) ? item.comboSelections : [],
      };
    });

    // --- UNIQUE ORDER NUMBER GENERATION ---
    const dateSuffix = Date.now().toString().slice(-4);
    const randomNum = Math.floor(100 + Math.random() * 900);
    const orderNumber = `ORD-${dateSuffix}-${randomNum}`;

    // --- REWARD COINS & CUSTOMER HANDLING ---
    const safeGrandTotal = Number(grandTotal) || 0;
    const rewardCoinsEarned = Math.floor(safeGrandTotal / 50);

    let customerObj = null;
    let cleanPhone = String(customerPhone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length >= 10) {
      cleanPhone = cleanPhone.slice(-10);
    } else {
      cleanPhone = null;
    }

    if (cleanPhone) {
      try {
        const finalAddress = customerAddress || deliveryAddress || '';
        let existingCustomer = await Customer.findOne({ phone: cleanPhone });

        if (existingCustomer) {
          if (customerName && customerName !== 'Guest') existingCustomer.name = customerName;
          if (finalAddress) existingCustomer.address = finalAddress;
          existingCustomer.totalOrders = (existingCustomer.totalOrders || 0) + 1;
          existingCustomer.totalSpent = (existingCustomer.totalSpent || 0) + safeGrandTotal;
          existingCustomer.rewardCoins = Math.max(
            0,
            (existingCustomer.rewardCoins || 0) - (Number(rewardCoinsUsed) || 0) + rewardCoinsEarned
          );
          await existingCustomer.save();
          customerObj = existingCustomer;
        } else {
          existingCustomer = await Customer.create({
            phone: cleanPhone,
            name: customerName || 'Guest',
            address: finalAddress,
            totalOrders: 1,
            totalSpent: safeGrandTotal,
            rewardCoins: rewardCoinsEarned,
          });
          customerObj = existingCustomer;
        }
      } catch (custErr) {
        console.error("⚠️ Customer Save Warning:", custErr.message);
      }
    }

    // --- CREATE ORDER DOCUMENT ---
    const orderDoc = {
      orderNumber,
      orderType: (orderType || 'takeaway').toLowerCase(),
      customerPhone: cleanPhone || 'N/A',
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
      grandTotal: safeGrandTotal,
      paymentMethod: (paymentMethod || 'cash').toLowerCase(),
      status: 'new',
    };

    if (customerObj) {
      orderDoc.customer = {
        _id: customerObj._id,
        phone: customerObj.phone,
        name: customerObj.name,
        rewardCoins: customerObj.rewardCoins,
      };
    } else {
      orderDoc.customer = {
        name: customerName || 'Guest',
        phone: cleanPhone || 'N/A',
      };
    }

    const newOrder = new Order(orderDoc);
    await newOrder.save();

    // Socket Emit
    const io = req.app.get('io');
    if (io) {
      io.emit('newOrder', newOrder);
    }

    return res.status(201).json({
      success: true,
      order: newOrder,
      customerData: customerObj,
    });
  } catch (err) {
    console.error('❌ POST /api/orders SERVER ERROR:', err);
    return res.status(500).json({
      success: false,
      message: err.message,
      errorDetails: err.errors || err.stack || err
    });
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