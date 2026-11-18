const Customer = require('../models/Customer');
const Order = require('../models/Order');

// Helper: 10-digit clean phone
const get10Digits = (p) => String(p || '').replace(/\D/g, '').slice(-10);
const safeNum = (v) => (isNaN(Number(v)) ? 0 : Number(v));

// @desc    Get all customers with search & pagination
// @route   GET /api/customers
// @access  Private
const getCustomers = async (req, res) => {
  try {
    const { search, page = 1, limit = 50, exportAll } = req.query;

    let query = {};

    if (search && search.trim()) {
      const term = search.trim();
      const cleanP = get10Digits(term);
      const searchRegex = new RegExp(term, 'i');
      
      const orConditions = [
        { name: searchRegex },
        { address: searchRegex },
        { phone: searchRegex }
      ];
      if (cleanP.length >= 4) {
        orConditions.push({ phone: { $regex: cleanP } });
      }
      query.$or = orConditions;
    }

    if (exportAll === 'true') {
      const customers = await Customer.find(query).sort({ updatedAt: -1, createdAt: -1 }).lean();
      return res.json({ customers, total: customers.length });
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [customers, total, stats] = await Promise.all([
      Customer.find(query)
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Customer.countDocuments(query),
      Customer.aggregate([
        {
          $group: {
            _id: null,
            totalSpentAll: { $sum: '$totalSpent' },
            totalCoinsAll: { $sum: '$rewardCoins' },
            totalOrdersAll: { $sum: '$totalOrders' }
          }
        }
      ])
    ]);

    const summaryStats = stats[0] || { totalSpentAll: 0, totalCoinsAll: 0, totalOrdersAll: 0 };

    res.json({
      customers,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
      stats: {
        totalCustomers: total,
        totalSpentAll: summaryStats.totalSpentAll || 0,
        totalCoinsAll: summaryStats.totalCoinsAll || 0,
        totalOrdersAll: summaryStats.totalOrdersAll || 0
      }
    });
  } catch (error) {
    console.error('getCustomers Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    🔥 SYNC & RECOVER ALL PAST CUSTOMERS FROM OLD ORDERS
// @route   POST /api/customers/sync
// @access  Private
const syncCustomersFromOrders = async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: 1 }).lean();
    const customerMap = {};

    for (const order of orders) {
      const rawPhone = order.customer?.phone || order.customerPhone || order.phone;
      const phone = get10Digits(rawPhone);
      if (!phone || phone.length !== 10) continue;

      if (!customerMap[phone]) {
        customerMap[phone] = {
          phone,
          name: 'Guest',
          address: '',
          totalOrders: 0,
          totalSpent: 0,
          earnedCoins: 0,
          usedCoins: 0,
          branch: order.branch || null
        };
      }

      const c = customerMap[phone];

      // Extract real name (ignore Guest if real name exists in any order)
      const ordName = (order.customer?.name || order.customerName || '').trim();
      if (ordName && ordName.toLowerCase() !== 'guest') {
        c.name = ordName;
      }

      // Extract address
      const ordAddr = (order.deliveryAddress || order.customerAddress || order.customer?.address || '').trim();
      if (ordAddr && !ordAddr.toLowerCase().includes('dine-in') && !ordAddr.toLowerCase().includes('table')) {
        c.address = ordAddr;
      }

      const status = String(order.status || '').toLowerCase();
      const isCancelled = ['cancelled', 'canceled', 'rejected'].includes(status);

      if (!isCancelled) {
        c.totalOrders += 1;
        c.totalSpent += safeNum(order.grandTotal);
        c.usedCoins += safeNum(order.rewardCoinsUsed);

        if (status === 'completed') {
          const earned = order.rewardCoinsEarned != null
            ? safeNum(order.rewardCoinsEarned)
            : Math.floor(safeNum(order.grandTotal) / 20);
          c.earnedCoins += earned;
        }
      }
    }

    let syncedCount = 0;
    for (const phone in customerMap) {
      const data = customerMap[phone];
      const rewardCoins = Math.max(0, data.earnedCoins - data.usedCoins);

      await Customer.findOneAndUpdate(
        {
          $or: [
            { phone: data.phone },
            { phone: { $regex: data.phone + '$' } }
          ]
        },
        {
          $set: {
            phone: data.phone,
            name: data.name,
            address: data.address,
            totalOrders: data.totalOrders,
            totalSpent: data.totalSpent,
            rewardCoins: rewardCoins,
            branch: data.branch
          }
        },
        { upsert: true, new: true }
      );
      syncedCount++;
    }

    res.json({
      success: true,
      message: `Successfully recovered & synced ${syncedCount} customer records from past orders!`,
      syncedCount
    });
  } catch (err) {
    console.error('Sync Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Add new customer
// @route   POST /api/customers
// @access  Private
const createCustomer = async (req, res) => {
  try {
    const branchId = req.user?.branch?._id || req.user?.branch || null;
    const { name, phone, address, rewardCoins } = req.body;

    const cleanPhone = get10Digits(phone);
    if (!cleanPhone || cleanPhone.length !== 10) {
      return res.status(400).json({ message: 'Valid 10-digit phone number is required' });
    }

    const existing = await Customer.findOne({
      $or: [
        { phone: cleanPhone },
        { phone: { $regex: cleanPhone + '$' } }
      ]
    });

    if (existing) {
      return res.status(400).json({ message: 'Customer with this phone already exists' });
    }

    const customer = await Customer.create({
      branch: branchId,
      name: name && name.trim() ? name.trim() : 'Guest',
      phone: cleanPhone,
      address: address ? address.trim() : '',
      rewardCoins: Number(rewardCoins) || 0,
      totalOrders: 0,
      totalSpent: 0
    });

    res.status(201).json(customer);
  } catch (error) {
    console.error('createCustomer Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private
const updateCustomer = async (req, res) => {
  try {
    const { name, phone, address, rewardCoins } = req.body;
    let updateFields = {};

    if (name !== undefined) updateFields.name = String(name).trim() || 'Guest';
    if (address !== undefined) updateFields.address = String(address).trim();
    if (rewardCoins !== undefined) updateFields.rewardCoins = Math.max(0, Number(rewardCoins) || 0);

    if (phone) {
      const cleanPhone = get10Digits(phone);
      if (cleanPhone.length === 10) {
        updateFields.phone = cleanPhone;
      }
    }

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true }
    );

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json(customer);
  } catch (error) {
    console.error('updateCustomer Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete customer
// @route   DELETE /api/customers/:id
// @access  Private
const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('deleteCustomer Error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getCustomers,
  syncCustomersFromOrders,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};