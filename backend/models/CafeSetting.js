const mongoose = require('mongoose');

const cafeSettingSchema = new mongoose.Schema(
  {
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      unique: true,
    },
    cafeName: { type: String, default: 'Perfect Pizza' },
    tagline: { type: String, default: "100% Pure Mozzarella's Pizza" },
    address: {
      type: String,
      default: 'Singhpur Chauraha, Bithoor Road, Kalyanpur, Kanpur Nagar',
    },
    phone: { type: String, default: '+91 9889229198' },
    whatsapp: { type: String, default: '+91 7800775619' },
    gstNumber: { type: String, default: '09BCVPDD4203L2ZB' },
    email: { type: String, default: '' },
    website: { type: String, default: 'perfectpizzas.in' },

    // Tax
    defaultGST: { type: Number, default: 5 },
    gstDefaultOn: { type: Boolean, default: false },

    // Invoice
    invoicePrefix: { type: String, default: 'PP-KLP-' },
    footerText: { type: String, default: 'Thank You! Visit Again 🍕' },
    workingHours: { type: String, default: '10:00 AM - 11:00 PM' },

    // Rewards
    earnAboveHundred: { type: Number, default: 20 }, // coins if bill > 100
    earnBelowOrEqualHundred: { type: Number, default: 10 }, // coins if bill <= 100
    rewardThreshold: { type: Number, default: 100 },
    coinsPerRedeemBlock: { type: Number, default: 20 }, // 20 coins
    redeemBlockValue: { type: Number, default: 5 }, // = ₹5

    // Kitchen
    soundEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CafeSetting', cafeSettingSchema);