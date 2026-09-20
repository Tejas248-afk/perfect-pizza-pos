const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    branch: {
      type: mongoose.Schema.Types.Mixed, // Allows String "Kalyanpur" or Branch ObjectId
      required: false,
      default: null,
    },
    orderNumber: {
      type: String,
      required: true,
    },
    orderType: {
      type: String,
      enum: ['delivery', 'takeaway', 'dine-in'],
      default: 'dine-in',
      required: true,
    },

    // Reference to Dine-in Table
    table: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    customer: {
      name: { type: String, default: 'Guest' },
      phone: { type: String, default: 'N/A' },
      id: { type: mongoose.Schema.Types.Mixed, default: null },
    },

    customerPhone: {
      type: String,
      default: 'N/A',
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
      default: 0,
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
    serviceCharge: {
      type: Number,
      default: 0,
    },
    gstAmount: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      default: 0,
    },

    paymentMethod: {
      type: String,
      enum: ['cash', 'upi', 'card', 'pending'],
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
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    completedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);