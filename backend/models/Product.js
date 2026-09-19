const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    hasSizes: {
      type: Boolean,
      default: false,
    },
    prices: {
      regular: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      large: { type: Number, default: 0 },
      single: { type: Number, default: 0 },
    },
    hasCrust: {
      type: Boolean,
      default: false,
    },
    hasAddons: {
      type: Boolean,
      default: false,
    },
    isSpicy: {
      type: Boolean,
      default: false,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },

    // COMBO FEATURE
    isCombo: {
      type: Boolean,
      default: false,
    },
    comboChoices: [
      {
        title: {
          type: String,
          required: true, // e.g. "Choose Pizza 1"
        },
        options: [
          {
            type: String, // e.g. "Onion Pizza", "Tomato Pizza"
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);