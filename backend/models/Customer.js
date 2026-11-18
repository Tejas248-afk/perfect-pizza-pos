const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    branch: { type: mongoose.Schema.Types.Mixed, default: null }, // String ya ObjectId dono allow karega
    name: { type: String, default: 'Guest', trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    address: { type: String, default: '', trim: true }, 
    rewardCoins: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Customer', customerSchema);