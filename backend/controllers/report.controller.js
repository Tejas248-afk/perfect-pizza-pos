const Order = require('../models/Order');

// @desc    Get Sales Summary & Analytics
// @route   GET /api/reports/summary
// @access  Private (Admin / Super-Admin)
const getSummaryReport = async (req, res) => {
  try {
    const branchId = req.user.branch._id || req.user.branch;
    const { startDate, endDate } = req.query;

    let filter = { branch: branchId, status: { $ne: 'cancelled' } };

    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: start, $lte: end };
    } else {
      // Default to Today
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      filter.createdAt = { $gte: start };
    }

    const orders = await Order.find(filter);

    let totalSales = 0;
    let totalOrders = orders.length;
    let totalGst = 0;
    let totalDiscount = 0;
    let totalDelivery = 0;

    let paymentSplit = { cash: 0, upi: 0, card: 0 };
    let orderTypeSplit = { delivery: 0, takeaway: 0, 'dine-in': 0 };
    let productSalesMap = {};

    orders.forEach(order => {
      totalSales += order.grandTotal || 0;
      totalGst += order.gstAmount || 0;
      totalDiscount += order.discount || 0;
      totalDelivery += order.deliveryCharge || 0;

      // Payment Split
      const pm = (order.paymentMethod || 'cash').toLowerCase();
      if (paymentSplit[pm] !== undefined) {
        paymentSplit[pm] += order.grandTotal || 0;
      } else {
        paymentSplit.cash += order.grandTotal || 0;
      }

      // Order Type Split
      const ot = (order.orderType || 'takeaway').toLowerCase();
      if (orderTypeSplit[ot] !== undefined) {
        orderTypeSplit[ot] += 1;
      }

      // Product-wise calculation
      (order.items || []).forEach(item => {
        const name = item.product?.name || item.productName || 'Item';
        const qty = Number(item.qty) || 1;
        const unitPrice = (Number(item.basePrice) || 0) + (Number(item.crustPrice) || 0) + (Number(item.addonsTotal) || 0);
        const revenue = unitPrice * qty;

        if (!productSalesMap[name]) {
          productSalesMap[name] = { qty: 0, revenue: 0 };
        }
        productSalesMap[name].qty += qty;
        productSalesMap[name].revenue += revenue;
      });
    });

    // Convert map to sorted array
    const topProducts = Object.keys(productSalesMap).map(name => ({
      name,
      qty: productSalesMap[name].qty,
      revenue: productSalesMap[name].revenue
    })).sort((a, b) => b.qty - a.qty);

    res.json({
      totalSales,
      totalOrders,
      averageOrderValue: totalOrders ? Math.round(totalSales / totalOrders) : 0,
      totalGst: Number(totalGst.toFixed(2)),
      totalDiscount,
      totalDelivery,
      paymentSplit,
      orderTypeSplit,
      topProducts
    });

  } catch (error) {
    console.error('Report Error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getSummaryReport };