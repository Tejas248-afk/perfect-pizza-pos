const mongoose = require('mongoose');

const inventoryLogSchema = new mongoose.Schema(
  {
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
    type: { type: String, enum: ['purchase', 'consumption', 'wastage'], required: true },
    quantity: { type: Number, required: true },
    note: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('InventoryLog', inventoryLogSchema);