const Inventory = require('../models/Inventory');
const InventoryLog = require('../models/InventoryLog');

// @desc    Get all inventory items
// @route   GET /api/inventory
const getInventory = async (req, res) => {
  try {
    const branchId = req.user.branch._id || req.user.branch;
    const items = await Inventory.find({ branch: branchId }).sort({ name: 1 });
    res.json(items);
  } catch (error) {
    console.error('getInventory Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add new inventory item
// @route   POST /api/inventory
const addItem = async (req, res) => {
  try {
    const { name, unit, minStock } = req.body;
    const branchId = req.user.branch._id || req.user.branch;

    if (!name || !unit) {
      return res.status(400).json({ message: 'Name and Unit are required' });
    }

    const item = await Inventory.create({
      branch: branchId,
      name,
      unit,
      minStock: Number(minStock) || 0,
      currentStock: 0
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('addItem Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update stock (Purchase, Consumption, Wastage)
// @route   POST /api/inventory/:id/log
const addStockLog = async (req, res) => {
  try {
    const { type, quantity, note } = req.body;
    const branchId = req.user.branch._id || req.user.branch;
    const itemId = req.params.id;
    const qty = Number(quantity);

    if (!qty || qty <= 0) {
      return res.status(400).json({ message: 'Valid quantity is required' });
    }

    const item = await Inventory.findOne({ _id: itemId, branch: branchId });
    if (!item) return res.status(404).json({ message: 'Item not found' });

    if (type === 'purchase') {
      item.currentStock += qty;
    } else if (type === 'consumption' || type === 'wastage') {
      if (item.currentStock < qty) {
        return res.status(400).json({ message: 'Not enough stock available' });
      }
      item.currentStock -= qty;
    }

    await item.save();

    const log = await InventoryLog.create({
      branch: branchId,
      item: itemId,
      type,
      quantity: qty,
      note: note || '',
      createdBy: req.user._id
    });

    res.json({ message: 'Stock updated', item, log });
  } catch (error) {
    console.error('addStockLog Error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getInventory, addItem, addStockLog };