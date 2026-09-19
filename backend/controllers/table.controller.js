const Table = require('../models/Table');
const Order = require('../models/Order');

// @desc    Get all tables
// @route   GET /api/tables
const getTables = async (req, res) => {
  try {
    const branchId = req.user.branch._id || req.user.branch;
    const tables = await Table.find({ branch: branchId }).populate('currentOrder');
    res.json(tables);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Seed 4 Tables
// @route   POST /api/tables/seed
const seedTables = async (req, res) => {
  try {
    const branchId = req.user.branch._id || req.user.branch;
    const count = await Table.countDocuments({ branch: branchId });
    if (count > 0) return res.json({ message: 'Tables already exist' });

    const tables = [
      { branch: branchId, tableNumber: 1, name: 'Table 1' },
      { branch: branchId, tableNumber: 2, name: 'Table 2' },
      { branch: branchId, tableNumber: 3, name: 'Table 3' },
      { branch: branchId, tableNumber: 4, name: 'Table 4' },
    ];
    await Table.insertMany(tables);
    res.json({ message: '4 Tables created successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Assign Order to Table (Make Occupied)
// @route   PATCH /api/tables/:id/assign
const assignOrderToTable = async (req, res) => {
  try {
    const { orderId } = req.body;
    const table = await Table.findById(req.params.id);
    table.status = 'occupied';
    table.currentOrder = orderId;
    await table.save();

    // Also update order with table reference
    const order = await Order.findById(orderId);
    order.table = table._id;
    await order.save();

    res.json({ message: 'Table occupied', table });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update Order (Add KOT items to running order)
// @route   PATCH /api/orders/:id/add-items
const addItemsToOrder = async (req, res) => {
  try {
    const { items, subtotal, discount, gstAmount, grandTotal } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Append new items
    order.items = [...order.items, ...items];
    order.subtotal = subtotal;
    order.discount = discount;
    order.gstAmount = gstAmount;
    order.grandTotal = grandTotal;
    
    // Status back to preparing since new items added
    if (order.status === 'ready' || order.status === 'completed') {
      order.status = 'preparing';
    }

    await order.save();

    // Alert Kitchen for new items
    const io = req.app.get('io');
    if (io) io.emit('orderUpdated', order);

    res.json({ message: 'KOT Added', order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Clear Table (After Bill Paid)
// @route   PATCH /api/tables/:id/clear
const clearTable = async (req, res) => {
  try {
    const table = await Table.findById(req.params.id).populate('currentOrder');
    if(!table) return res.status(404).json({ message: "Table not found" });

    // Mark order as completed and paid
    if (table.currentOrder) {
      const order = await Order.findById(table.currentOrder._id);
      order.status = 'completed';
      order.paymentStatus = 'paid';
      order.paymentMethod = req.body.paymentMethod || 'cash';
      order.completedAt = new Date();
      await order.save();

      const io = req.app.get('io');
      if (io) io.emit('orderUpdated', order);
    }

    // Free the table
    table.status = 'available';
    table.currentOrder = null;
    await table.save();
    
    res.json({ message: 'Table cleared & Order Completed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getTables, seedTables, assignOrderToTable, addItemsToOrder, clearTable };