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

    // 2. Handle Customer & Rewards Persistence
    let customer = null;
    let rewardCoinsEarned = 0;

    if (customerPhone) {
      const cleanPhone = String(customerPhone).trim().replace(/[^0-9]/g, '').slice(-10);
      const inputName = customerName ? customerName.trim() : '';
      const inputAddr = (deliveryAddress || customerAddress || '').trim();

      customer = await Customer.findOne({ phone: cleanPhone });

      if (!customer) {
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

      await customer.save();
    }

    let finalAddress = (deliveryAddress || customerAddress || '').trim();
    if (!finalAddress && customer && customer.address) {
      finalAddress = customer.address;
    }

    // 3. Create Order
    const order = new Order({
      branch: branchId,
      orderNumber: invoiceNo,
      orderType,
      customer: customer
        ? { name: customer.name, phone: customer.phone, id: customer._id }
        : { name: (customerName && customerName !== 'Guest') ? customerName : 'Guest', phone: customerPhone || 'N/A' },
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

// @desc    Lookup customer by phone (WITH AUTO SYNC FIX)
// @route   GET /api/orders/customer/:phone
// @access  Private
const lookupCustomer = async (req, res) => {
  try {
    const rawPhone = req.params.phone ? req.params.phone.trim() : '';
    const cleanPhone = rawPhone.replace(/[^0-9]/g, '').slice(-10);

    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ message: 'Valid 10-digit phone number is required' });
    }

    // Fetch all previous orders for this phone number
    const allOrders = await Order.find({
      $or: [
        { 'customer.phone': cleanPhone },
        { 'customer.phone': rawPhone }
      ]
    }).sort({ createdAt: -1 });

    let customer = await Customer.findOne({ phone: cleanPhone });

    // Check if there is a real name in order history
    let realNameFromOrders = '';
    allOrders.forEach(o => {
      const n = o.customer?.name || o.customerName || '';
      if (n && n.toLowerCase() !== 'guest' && !realNameFromOrders) {
        realNameFromOrders = n;
      }
    });

    const nonCancelled = allOrders.filter(o => !['cancelled', 'canceled'].includes(String(o.status || '').toLowerCase()));
    const computedOrdersCount = nonCancelled.length;
    const computedSpent = nonCancelled.reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0);

    if (!customer) {
      if (allOrders.length === 0) {
        return res.json({ found: false });
      }
      // Auto-create Customer profile if missing
      const computedCoins = nonCancelled.reduce((sum, o) => sum + (Number(o.rewardCoinsEarned) || (o.grandTotal > 100 ? 20 : 10)), 0);
      customer = new Customer({
        phone: cleanPhone,
        name: realNameFromOrders || 'Guest',
        rewardCoins: computedCoins,
        totalOrders: computedOrdersCount,
        totalSpent: computedSpent
      });
      await customer.save();
    } else {
      let needsSave = false;
      // Sync Real Name
      if ((!customer.name || customer.name.toLowerCase() === 'guest') && realNameFromOrders) {
        customer.name = realNameFromOrders;
        needsSave = true;
      }
      // Sync Stats if desynced
      if ((customer.totalOrders || 0) === 0 && computedOrdersCount > 0) {
        customer.totalOrders = computedOrdersCount;
        customer.totalSpent = computedSpent;
        if ((customer.rewardCoins || 0) === 0) {
          customer.rewardCoins = nonCancelled.reduce((sum, o) => sum + (Number(o.rewardCoinsEarned) || (o.grandTotal > 100 ? 20 : 10)), 0);
        }
        needsSave = true;
      }
      if (needsSave) {
        await customer.save();
      }
    }

    const previousOrders = allOrders.slice(0, 5).map(o => ({
      _id: o._id,
      orderNumber: o.orderNumber,
      grandTotal: o.grandTotal,
      orderType: o.orderType,
      createdAt: o.createdAt,
      status: o.status,
      items: o.items,
      deliveryAddress: o.deliveryAddress,
      customer: o.customer
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