const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Order = require('../models/Order');
const Customer = require('../models/Customer');

// 1. GET Customer Lookup
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
    return res.status(500).json({ found: false, message: err.message });
  }
});

// 2. GET All Orders
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
    res.status(500).json({ message: err.message });
  }
});

// 3. GET Single Order
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 4. POST Create Order
router.post('/', async (req, res) => {
  try {
    const {
      branch,
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

    const count = await Order.countDocuments().catch(() => 0);
    const orderNumber = `ORD-${101 + count}`;

    const safeGrandTotal = Number(grandTotal) || 0;
    const rewardCoinsEarned = Math.floor(safeGrandTotal / 50);

    let cleanPhone = String(customerPhone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length >= 10) cleanPhone = cleanPhone.slice(-10);
    else cleanPhone = 'N/A';

    let customerObj = { name: customerName || 'Guest', phone: cleanPhone };
    if (cleanPhone !== 'N/A') {
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
          customerObj = {
            id: existingCustomer._id,
            name: existingCustomer.name,
            phone: existingCustomer.phone
          };
        } else {
          const newCust = await Customer.create({
            phone: cleanPhone,
            name: customerName || 'Guest',
            address: finalAddress,
            totalOrders: 1,
            totalSpent: safeGrandTotal,
            rewardCoins: rewardCoinsEarned,
          });
          customerObj = {
            id: newCust._id,
            name: newCust.name,
            phone: newCust.phone
          };
        }
      } catch (custErr) {
        console.error("Customer save error:", custErr.message);
      }
    }

    // Enum Safe values
    const validOrderTypes = ['delivery', 'takeaway', 'dine-in'];
    const safeOrderType = validOrderTypes.includes(String(orderType).toLowerCase()) 
      ? String(orderType).toLowerCase() 
      : 'dine-in';

    const validPayMethods = ['cash', 'upi', 'card', 'pending'];
    const safePayMethod = validPayMethods.includes(String(paymentMethod).toLowerCase()) 
      ? String(paymentMethod).toLowerCase() 
      : 'cash';

    const newOrder = new Order({
      branch: branch || null,
      orderNumber,
      orderType: safeOrderType,
      customer: customerObj,
      customerPhone: cleanPhone,
      deliveryAddress: deliveryAddress || '',
      items: items || [],
      subtotal: Number(subtotal) || 0,
      discount: Number(discount) || 0,
      rewardCoinsUsed: Number(rewardCoinsUsed) || 0,
      rewardCoinsValue: Number(rewardCoinsValue) || 0,
      rewardCoinsEarned,
      serviceCharge: Number(serviceCharge) || 0,
      deliveryCharge: Number(deliveryCharge) || 0,
      gstAmount: Number(gstAmount) || 0,
      grandTotal: safeGrandTotal,
      paymentMethod: safePayMethod,
      paymentStatus: safePayMethod === 'pending' ? 'pending' : 'paid',
      status: 'new',
    });

    await newOrder.save();

    const io = req.app.get('io');
    if (io) io.emit('newOrder', newOrder);

    return res.status(201).json({
      success: true,
      order: newOrder,
      customerData: customerObj,
    });
  } catch (err) {
    console.error('❌ ORDER CREATION ERROR:', err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// 5. PATCH Update Status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const io = req.app.get('io');
    if (io) io.emit('orderUpdated', order);

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 6. PATCH Add KOT Items
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
    if (io) io.emit('orderUpdated', order);

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;