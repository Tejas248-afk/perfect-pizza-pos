const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema(
  {
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    tableNumber: { type: Number, required: true },
    name: { type: String, required: true }, // e.g. "Table 1"
    status: {
      type: String,
      enum: ['available', 'occupied'],
      default: 'available',
    },
    currentOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Table', tableSchema);