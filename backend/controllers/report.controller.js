const Order = require('../models/Order');

// @desc    Get Sales Summary & Analytics
// @route   GET /api/reports/summary
// @access  Private (Admin / Super-Admin)
const getSummaryReport = async (req, res) => {
  try {
    const branchId = req.user.branch._id || req.user.branch;
    const { startDate, endDate } = req.query;

    // ---- Date Range ----
    let start, end;
    if (startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      // Default = Today
      start = new Date();
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
    }

    const baseFilter = {
      branch: branchId,
      createdAt: { $gte: start, $lte: end },
    };

    // 1) Completed / Active sales (cancelled छोड़कर)
    const orders = await Order.find({
      ...baseFilter,
      status: { $ne: 'cancelled' },
    });

    // 2) Cancelled orders (अलग)
    const cancelledOrders = await Order.find({
      ...baseFilter,
      status: 'cancelled',
    });

    let totalSales = 0;       // Net sales (cancelled के बिना)
    let totalOrders = orders.length;
    let totalGst = 0;
    let totalDiscount = 0;
    let totalDelivery = 0;
    let totalSubTotal = 0;

    let paymentSplit = { cash: 0, upi: 0, card: 0 };
    let orderTypeSplit = { delivery: 0, takeaway: 0, 'dine-in': 0 };
    let productSalesMap = {};

    // ---- Daily breakdown map ----
    // key = "YYYY-MM-DD"
    const dailyMap = {};

    const getDayKey = (date) => {
      const d = new Date(date);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const getDayLabel = (date) => {
      return new Date(date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    };

    const ensureDay = (key, label) => {
      if (!dailyMap[key]) {
        dailyMap[key] = {
          date: label,
          dateKey: key,
          orders: 0,
          subTotal: 0,
          tax: 0,
          discount: 0,
          charges: 0,
          grossSales: 0,
          cancelledAmount: 0,
          cancelledOrders: 0,
          netSales: 0,
        };
      }
      return dailyMap[key];
    };

    // ---- Process normal (non-cancelled) orders ----
    orders.forEach((order) => {
      const grand = Number(order.grandTotal) || 0;
      const gst = Number(order.gstAmount) || 0;
      const discount = Number(order.discount) || 0;
      const delivery = Number(order.deliveryCharge) || 0;

      // subTotal approximate: grand - gst - delivery + discount
      // (अगर model में subTotal/field हो तो वो use कर लो)
      const subTotal =
        Number(order.subTotal) ||
        Math.max(grand - gst - delivery + discount, 0);

      totalSales += grand;
      totalGst += gst;
      totalDiscount += discount;
      totalDelivery += delivery;
      totalSubTotal += subTotal;

      // Payment Split
      const pm = (order.paymentMethod || 'cash').toLowerCase();
      if (paymentSplit[pm] !== undefined) {
        paymentSplit[pm] += grand;
      } else {
        paymentSplit.cash += grand;
      }

      // Order Type Split
      const ot = (order.orderType || 'takeaway').toLowerCase();
      if (orderTypeSplit[ot] !== undefined) {
        orderTypeSplit[ot] += 1;
      }

      // Product-wise
      (order.items || []).forEach((item) => {
        const name = item.product?.name || item.productName || 'Item';
        const qty = Number(item.qty) || 1;
        const unitPrice =
          (Number(item.basePrice) || 0) +
          (Number(item.crustPrice) || 0) +
          (Number(item.addonsTotal) || 0);
        const revenue = unitPrice * qty;

        if (!productSalesMap[name]) {
          productSalesMap[name] = { qty: 0, revenue: 0 };
        }
        productSalesMap[name].qty += qty;
        productSalesMap[name].revenue += revenue;
      });

      // Daily row
      const key = getDayKey(order.createdAt);
      const day = ensureDay(key, getDayLabel(order.createdAt));
      day.orders += 1;
      day.subTotal += subTotal;
      day.tax += gst;
      day.discount += discount;
      day.charges += delivery;
      day.grossSales += grand;
      day.netSales += grand;
    });

    // ---- Process cancelled orders ----
    let totalCancelledOrders = cancelledOrders.length;
    let totalCancelledAmount = 0;

    cancelledOrders.forEach((order) => {
      const grand = Number(order.grandTotal) || 0;
      totalCancelledAmount += grand;

      const key = getDayKey(order.createdAt);
      const day = ensureDay(key, getDayLabel(order.createdAt));
      day.cancelledOrders += 1;
      day.cancelledAmount += grand;
      // Net sales में cancelled नहीं जोड़ते (पहले से 0)
    });

    // ---- Top Products ----
    const topProducts = Object.keys(productSalesMap)
      .map((name) => ({
        name,
        qty: productSalesMap[name].qty,
        revenue: Number(productSalesMap[name].revenue.toFixed(2)),
      }))
      .sort((a, b) => b.qty - a.qty);

    // ---- Daily Breakdown array (newest date first) ----
    const dailyBreakdown = Object.values(dailyMap)
      .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1))
      .map((d) => ({
        date: d.date,
        orders: d.orders,
        subTotal: Number(d.subTotal.toFixed(2)),
        tax: Number(d.tax.toFixed(2)),
        discount: Number(d.discount.toFixed(2)),
        charges: Number(d.charges.toFixed(2)),
        grossSales: Number(d.grossSales.toFixed(2)),
        cancelledAmount: Number(d.cancelledAmount.toFixed(2)),
        cancelledOrders: d.cancelledOrders,
        netSales: Number(d.netSales.toFixed(2)),
      }));

    res.json({
      // KPIs
      totalSales: Number(totalSales.toFixed(2)),
      totalOrders,
      averageOrderValue: totalOrders
        ? Math.round(totalSales / totalOrders)
        : 0,
      totalGst: Number(totalGst.toFixed(2)),
      totalDiscount: Number(totalDiscount.toFixed(2)),
      totalDelivery: Number(totalDelivery.toFixed(2)),
      totalSubTotal: Number(totalSubTotal.toFixed(2)),

      // Cancelled (Frontend KPI card)
      totalCancelledOrders,
      totalCancelledAmount: Number(totalCancelledAmount.toFixed(2)),

      // Splits
      paymentSplit: {
        cash: Number(paymentSplit.cash.toFixed(2)),
        upi: Number(paymentSplit.upi.toFixed(2)),
        card: Number(paymentSplit.card.toFixed(2)),
      },
      orderTypeSplit,

      // Tables
      topProducts,
      dailyBreakdown,
    });
  } catch (error) {
    console.error('Report Error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getSummaryReport };