const Order = require('../models/Order');

// @desc    Get Sales Summary & Analytics
// @route   GET /api/reports/summary
// @access  Private (Admin / Super-Admin)
const getSummaryReport = async (req, res) => {
  try {
    const branchId = req.user?.branch?._id || req.user?.branch;
    const { startDate, endDate } = req.query;

    let baseFilter = {};
    if (branchId) {
      baseFilter.branch = branchId;
    }

    // ---- Date Range in IST (India Standard Time) ----
    let start, end;

    if (startDate && endDate) {
      start = new Date(`${startDate}T00:00:00.000+05:30`);
      end = new Date(`${endDate}T23:59:59.999+05:30`);
    } else {
      // Default: Today in IST
      const now = new Date();
      const indiaDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
      start = new Date(`${indiaDateStr}T00:00:00.000+05:30`);
      end = new Date(`${indiaDateStr}T23:59:59.999+05:30`);
    }

    baseFilter.createdAt = { $gte: start, $lte: end };

    // Saare orders ek baar me laao
    const allOrders = await Order.find(baseFilter);

    let totalSales = 0;
    let totalOrders = 0;
    let totalGst = 0;
    let totalDiscount = 0;
    let totalDelivery = 0;
    let totalSubTotal = 0;

    let totalCancelledOrders = 0;
    let totalCancelledAmount = 0;

    let paymentSplit = { cash: 0, upi: 0, card: 0 };
    let orderTypeSplit = { delivery: 0, takeaway: 0, 'dine-in': 0 };
    let productSalesMap = {};
    const dailyMap = {};

    // Helper: IST Format me Date Key banana
    const getISTDateInfo = (dateObj) => {
      const d = new Date(dateObj);
      const dateKey = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const label = d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata'
      });
      return { dateKey, label };
    };

    const ensureDay = (dateKey, label) => {
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = {
          date: label,
          dateKey: dateKey,
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
      return dailyMap[dateKey];
    };

    allOrders.forEach((order) => {
      const { dateKey, label } = getISTDateInfo(order.createdAt);
      const day = ensureDay(dateKey, label);

      const statusLower = String(order.status || '').toLowerCase().trim();
      const isCancelled = statusLower === 'cancelled' || statusLower === 'canceled';

      const grand = Number(order.grandTotal) || 0;
      const gst = Number(order.gstAmount) || 0;
      const discount = Number(order.discount) || 0;
      const delivery = Number(order.deliveryCharge) || 0;
      const subTotal = Number(order.subTotal) || Math.max(grand - gst - delivery + discount, 0);

      if (isCancelled) {
        // CANCELLED ORDER LOGIC
        totalCancelledOrders += 1;
        totalCancelledAmount += grand;

        day.cancelledOrders += 1;
        day.cancelledAmount += grand;
      } else {
        // COMPLETED / ACTIVE ORDER LOGIC
        totalOrders += 1;
        totalSales += grand;
        totalGst += gst;
        totalDiscount += discount;
        totalDelivery += delivery;
        totalSubTotal += subTotal;

        // Payment Split
        const pm = (order.paymentMethod || 'cash').toLowerCase().trim();
        if (paymentSplit[pm] !== undefined) {
          paymentSplit[pm] += grand;
        } else {
          paymentSplit.cash += grand;
        }

        // Order Type Split
        const ot = (order.orderType || 'takeaway').toLowerCase().trim();
        if (orderTypeSplit[ot] !== undefined) {
          orderTypeSplit[ot] += 1;
        }

        // Top Products
        (order.items || []).forEach((item) => {
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

        // Day Row Stats
        day.orders += 1;
        day.subTotal += subTotal;
        day.tax += gst;
        day.discount += discount;
        day.charges += delivery;
        day.grossSales += grand;
        day.netSales += grand;
      }
    });

    // Top Products Array
    const topProducts = Object.keys(productSalesMap)
      .map((name) => ({
        name,
        qty: productSalesMap[name].qty,
        revenue: Number(productSalesMap[name].revenue.toFixed(2)),
      }))
      .sort((a, b) => b.qty - a.qty);

    // Daily Breakdown Array
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
      totalSales: Number(totalSales.toFixed(2)),
      totalOrders,
      averageOrderValue: totalOrders ? Math.round(totalSales / totalOrders) : 0,
      totalGst: Number(totalGst.toFixed(2)),
      totalDiscount: Number(totalDiscount.toFixed(2)),
      totalDelivery: Number(totalDelivery.toFixed(2)),
      totalSubTotal: Number(totalSubTotal.toFixed(2)),

      totalCancelledOrders,
      totalCancelledAmount: Number(totalCancelledAmount.toFixed(2)),

      paymentSplit: {
        cash: Number(paymentSplit.cash.toFixed(2)),
        upi: Number(paymentSplit.upi.toFixed(2)),
        card: Number(paymentSplit.card.toFixed(2)),
      },
      orderTypeSplit,

      topProducts,
      dailyBreakdown,
    });
  } catch (error) {
    console.error('Report Error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getSummaryReport };