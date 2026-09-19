const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      default: 'Perfect Pizza - Kalyanpur',
    },
    code: {
      type: String,
      required: true,
      unique: true,
      default: 'PP-KLP',
    },
    address: {
      type: String,
      default: 'Singhpur Chauraha, Bithoor Road, Kalyanpur, Kanpur Nagar',
    },
    phone: {
      type: String,
      default: '+91 9889229198',
    },
    whatsapp: {
      type: String,
      default: '+91 7800775619',
    },
    gstNumber: {
      type: String,
      default: '09BCVPDD4203L2ZB',
    },
    invoicePrefix: {
      type: String,
      default: 'PP-KLP-',
    },
    currentInvoiceNumber: {
      type: Number,
      default: 100,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Branch', branchSchema);