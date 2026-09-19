const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    name: { type: String, required: true },
    unit: { type: String, enum: ['kg', 'litre', 'pcs', 'pkt'], required: true },
    currentStock: { type: Number, default: 0 },
    minStock: { type: Number, default: 0 }, // Low stock alert ke liye
  },
  { timestamps: true }
);

module.exports = mongoose.model('Inventory', inventorySchema);