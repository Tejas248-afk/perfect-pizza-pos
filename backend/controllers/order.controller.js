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

    // 1. Generate Invoice Number
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return res.status(404).json({ message: 'Branch not found' });
    }

    const invoiceNo = `${branch.invoicePrefix}${branch.currentInvoiceNumber}`;
    branch.currentInvoiceNumber += 1;
    await branch.save();

    // 2. Handle Customer & Rewards Persistence (FIXED)
    let customer = null;
    let rewardCoinsEarned = 0;

    if (customerPhone) {
      const cleanPhone = String(customerPhone).trim().replace(/[^0-9]/g, '').slice(-10);
      const inputName = customerName ? customerName.trim() : '';
      const inputAddr = (customerAddress || deliveryAddress || '').trim();

      // Find customer by phone number (Global lookup across branch to prevent duplicate zero-coin profiles)
      customer = await Customer.findOne({ phone: cleanPhone });

      if (!customer) {
        // Naya Customer Profile
        customer = new Customer({
          branch: branchId,
          phone: cleanPhone,
          name: (inputName && inputName.toLowerCase() !== 'guest') ? inputName : 'Guest',
          address: inputAddr,
          rewardCoins: 0,
          totalOrders: 0,
          totalSpent: 0
        });
      } else {
        // Existing Customer -> Update Name if POS sent a valid non-guest name!
        if (inputName && inputName.toLowerCase() !== 'guest') {
          customer.name = inputName;
        }
        if (inputAddr) {
          customer.address = inputAddr;
        }
      }

      // Redeem coins if requested
      const coinsToRedeem = Number(rewardCoinsUsed) || 0;
      if (coinsToRedeem > 0) {
        const currentCoins = Number(customer.rewardCoins) || 0;
        if (currentCoins < coinsToRedeem) {
          return res.status(400).json({ message: 'Not enough reward coins' });
        }
        if (coinsToRedeem % 20 !== 0) {
          return res.status(400).json({ message: 'Coins must be redeemed in multiples of 20' });
        }
        customer.rewardCoins = currentCoins - coinsToRedeem;
      }

      // Earn Rewards: Order > 100 ? 20 coins : 10 coins
      rewardCoinsEarned = Number(grandTotal) > 100 ? 20 : 10;

      customer.rewardCoins = (Number(customer.rewardCoins) || 0) + rewardCoinsEarned;
      customer.totalOrders = (Number(customer.totalOrders) || 0) + 1;
      customer.totalSpent = (Number(customer.totalSpent) || 0) + Number(grandTotal);

      // Persist Customer Changes to MongoDB
      await customer.save();
    }

    // 3. Create Order
    const order = new Order({
      branch: branchId,
      orderNumber: invoiceNo,
      orderType,
      customer: customer
        ? { name: customer.name, phone: customer.phone, id: customer._id }
        : { name: (customerName && customerName !== 'Guest') ? customerName : 'Guest', phone: customerPhone || 'N/A' },
      deliveryAddress: deliveryAddress || customerAddress || '',
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

    // 4. Emit real-time event to Kitchen Display & Orders Page
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
    const rawPhone = req.params.phone ? req.params.phone.trim() : '';
    const cleanPhone = rawPhone.replace(/[^0-9]/g, '').slice(-10);

    if (!cleanPhone) {
      return res.status(400).json({ message: 'Valid 10-digit phone number is required' });
    }

    // Lookup customer by phone globally so coins and history are always preserved
    const customer = await Customer.findOne({ phone: cleanPhone });
    if (!customer) {
      return res.json({ found: false });
    }

    // Fetch Last 5 orders for this customer
    const previousOrders = await Order.find({
      $or: [
        { 'customer.phone': cleanPhone },
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
    const branchId = req.user?.branch?._id || req.user?.branch;
    const { status, today } = req.query;

    let filter = {};
    if (branchId) filter.branch = branchId;

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

    // Emit status update to Kitchen & Orders Page
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