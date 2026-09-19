const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    orderType: {
      type: String,
      enum: ['delivery', 'takeaway', 'dine-in'],
      required: true,
    },

    // Reference to Dine-in Table
    table: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Table',
      default: null,
    },

    customer: {
      name: String,
      phone: String,
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    },

    deliveryAddress: {
      type: String,
      default: '',
    },

    items: {
      type: Array,
      default: [], // Array of cart item objects
    },

    subtotal: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    rewardCoinsUsed: {
      type: Number,
      default: 0,
    },
    rewardCoinsValue: {
      type: Number,
      default: 0,
    },
    deliveryCharge: {
      type: Number,
      default: 0,
    },
        serviceCharge: { type: Number, default: 0 },
    gstAmount: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
    },

    paymentMethod: {
      type: String,
      enum: ['cash', 'upi', 'card', 'pending'], // Added pending for dine-in running orders
      default: 'cash',
    },
    paymentStatus: {
      type: String,
      enum: ['paid', 'pending'],
      default: 'paid',
    },

    rewardCoinsEarned: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ['new', 'preparing', 'ready', 'completed', 'cancelled'],
      default: 'new',
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    completedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);