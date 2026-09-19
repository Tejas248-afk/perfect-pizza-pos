const mongoose = require('mongoose');

const addonSchema = new mongoose.Schema(
  {
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    prices: {
      regular: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      large: { type: Number, default: 0 },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Addon', addonSchema);