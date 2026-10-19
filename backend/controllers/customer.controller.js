const Customer = require('../models/Customer');

// @desc    Get all customers with search & pagination
// @route   GET /api/customers
// @access  Private
const getCustomers = async (req, res) => {
  try {
    const branchId = req.user.branch._id || req.user.branch;
    const { search, page = 1, limit = 50, exportAll } = req.query;

    let query = { branch: branchId };

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { phone: searchRegex },
        { address: searchRegex },
      ];
    }

    if (exportAll === 'true') {
      const customers = await Customer.find(query).sort({ updatedAt: -1 }).lean();
      return res.json({ customers, total: customers.length });
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [customers, total] = await Promise.all([
      Customer.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Customer.countDocuments(query),
    ]);

    res.json({
      customers,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error('getCustomers Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add new customer
// @route   POST /api/customers
// @access  Private
const createCustomer = async (req, res) => {
  try {
    const branchId = req.user.branch._id || req.user.branch;
    const { name, phone, address } = req.body;

    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    let phoneStr = String(phone).replace(/[^0-9]/g, '');
    if (phoneStr.length >= 10) phoneStr = phoneStr.slice(-10);

    const existing = await Customer.findOne({ branch: branchId, phone: phoneStr });
    if (existing) {
      return res.status(400).json({ message: 'Customer with this phone already exists' });
    }

    const customer = await Customer.create({
      branch: branchId,
      name: name || 'Guest',
      phone: phoneStr,
      address: address || '',
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
    const { name, phone, address } = req.body;
    let updateFields = {};

    if (name !== undefined) updateFields.name = String(name).trim();
    if (address !== undefined) updateFields.address = String(address).trim();
    if (phone) {
      let phoneStr = String(phone).replace(/[^0-9]/g, '');
      if (phoneStr.length >= 10) phoneStr = phoneStr.slice(-10);
      updateFields.phone = phoneStr;
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
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
