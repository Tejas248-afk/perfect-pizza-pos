const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Branch = require('../models/Branch');

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const createOrder = async (req, res) => {
  try {
    const {
      orderType,
      customerPhone,
      customerName,
      deliveryAddress,
      items,
      subtotal,
      discount,
      rewardCoinsUsed = 0,
      rewardCoinsValue = 0,
      serviceCharge,    // <-- Added Service Charge
      deliveryCharge,
      gstAmount,
      grandTotal,
      paymentMethod,
    } = req.body;

    const branchId = req.user.branch._id || req.user.branch;

    // 1. Generate Invoice Number
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return res.status(404).json({ message: 'Branch not found' });
    }

    const invoiceNo = `${branch.invoicePrefix}${branch.currentInvoiceNumber}`;
    branch.currentInvoiceNumber += 1;
    await branch.save();

    // 2. Handle Customer & Rewards
    let customer = null;
    let rewardCoinsEarned = 0;

    if (customerPhone) {
      const cleanPhone = customerPhone.trim();

      customer = await Customer.findOne({ phone: cleanPhone, branch: branchId });

      if (!customer) {
        customer = new Customer({
          branch: branchId,
          phone: cleanPhone,
          name: customerName || 'Guest',
        });
      } else if (customerName && (customer.name === 'Guest' || !customer.name)) {
        customer.name = customerName;
      }

      // Redeem coins if requested
      if (rewardCoinsUsed > 0) {
        if (customer.rewardCoins < rewardCoinsUsed) {
          return res.status(400).json({ message: 'Not enough reward coins' });
        }
        if (rewardCoinsUsed % 20 !== 0) {
          return res.status(400).json({ message: 'Coins must be redeemed in multiples of 20' });
        }
        customer.rewardCoins -= rewardCoinsUsed;
      }

      // Earn Rewards: Order > 100 ? 20 coins : 10 coins
      rewardCoinsEarned = grandTotal > 100 ? 20 : 10;

      customer.rewardCoins += rewardCoinsEarned;
      customer.totalOrders += 1;
      customer.totalSpent += grandTotal;
      await customer.save();
    }

    // 3. Create Order
    const order = new Order({
      branch: branchId,
      orderNumber: invoiceNo,
      orderType,
      customer: customer
        ? { name: customer.name, phone: customer.phone, id: customer._id }
        : { name: customerName || 'Guest', phone: customerPhone || 'N/A' },
      deliveryAddress: deliveryAddress || '',
      items,
      subtotal,
      discount: discount || 0,
      rewardCoinsUsed: rewardCoinsUsed || 0,
      rewardCoinsValue: rewardCoinsValue || 0,
      serviceCharge: serviceCharge || 0, // <-- Saved to DB
      deliveryCharge: deliveryCharge || 0,
      gstAmount: gstAmount || 0,
      grandTotal,
      paymentMethod: paymentMethod || 'cash',
      rewardCoinsEarned,
      createdBy: req.user._id,
    });

    const createdOrder = await order.save();

    // 4. Emit real-time event to Kitchen Display
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

// @desc    Lookup customer by phone
// @route   GET /api/orders/customer/:phone
// @access  Private
const lookupCustomer = async (req, res) => {
  try {
    const branchId = req.user.branch._id || req.user.branch;
    const phone = req.params.phone ? req.params.phone.trim() : '';

    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    const customer = await Customer.findOne({ phone, branch: branchId });
    if (!customer) {
      return res.json({ found: false });
    }

    // Last 5 orders
    const previousOrders = await Order.find({
      branch: branchId,
      $or: [
        { 'customer.phone': phone },
        { 'customer.id': customer._id },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('orderNumber grandTotal orderType createdAt status items deliveryAddress');

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

// @desc    Get orders (today / by status)
// @route   GET /api/orders
// @access  Private
const getOrders = async (req, res) => {
  try {
    const branchId = req.user.branch._id || req.user.branch;
    const { status, today } = req.query;

    let filter = { branch: branchId };

    if (status) {
      filter.status = status;
    }

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
// @route   GET /api/orders/:id
// @access  Private
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
// @route   PATCH /api/orders/:id/status
// @access  Private
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.status = status;
    if (status === 'completed') {
      order.completedAt = new Date();
    }
    await order.save();

    // Emit status update to Kitchen
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