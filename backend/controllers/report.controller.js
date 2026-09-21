const Order = require('../models/Order');

// @desc    Get Sales Summary & Analytics (ERP Style)
// @route   GET /api/reports/summary
// @access  Private (Admin / Super-Admin)
const getSummaryReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Helper: IST Date String YYYY-MM-DD
    const getISTDateStr = (d = new Date()) => {
      const istTime = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
      return istTime.toISOString().split('T')[0];
    };

    const todayIST = getISTDateStr(new Date());
    const sDateStr = startDate || todayIST;
    const eDateStr = endDate || todayIST;

    // Indian Midnight to Midnight in UTC Date Objects
    const startUTC = new Date(`${sDateStr}T00:00:00.000+05:30`);
    const endUTC = new Date(`${eDateStr}T23:59:59.999+05:30`);

    // Mongo Query - No strict branch block so ALL test orders appear
    const query = {
      createdAt: { $gte: startUTC, $lte: endUTC }
    };

    const rawOrders = await Order.find(query).sort({ createdAt: -1 }).lean();
    console.log(`📊 Reports Query [${sDateStr} to ${eDateStr}]: Found ${rawOrders.length} orders.`);

    const dailyMap = {};

    rawOrders.forEach(order => {
      // Calculate IST date key for grouping
      const dateKey = getISTDateStr(new Date(order.createdAt));
      
      const istObj = new Date(new Date(order.createdAt).getTime() + (5.5 * 60 * 60 * 1000));
      const dateLabel = istObj.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = {
          date: dateLabel,
          dateKey: dateKey,
          orders: 0,
          subTotal: 0,
          discount: 0,
          tax: 0,
          charges: 0,
          grossSales: 0,
          cancelledAmount: 0,
          cancelledOrders: 0,
          netSales: 0
        };
      }

      const day = dailyMap[dateKey];
      const statusLower = String(order.status || '').toLowerCase().trim();
      const isCancelled = ['cancelled', 'canceled', 'cancel', 'rejected'].includes(statusLower);

      const grand = Number(order.grandTotal) || 0;
      const gst = Number(order.gstAmount) || 0;
      const discount = Number(order.discount) || 0;
      const delivery = Number(order.deliveryCharge) || 0;
      const subTotal = Number(order.subTotal) || Math.max(grand - gst - delivery + discount, 0);

      if (isCancelled) {
        day.cancelledOrders += 1;
        day.cancelledAmount += grand;
      } else {
        day.orders += 1;
        day.subTotal += subTotal;
        day.discount += discount;
        day.tax += gst;
        day.charges += delivery;
        day.grossSales += grand;
        day.netSales += grand;
      }
    });

    // Array sorted by date (newest first)
    const dailyBreakdown = Object.values(dailyMap).sort((a, b) => b.dateKey.localeCompare(a.dateKey));

    // Totals KPI
    let totalSales = 0;
    let totalOrders = 0;
    let totalGst = 0;
    let totalCancelledOrders = 0;
    let totalCancelledAmount = 0;

    dailyBreakdown.forEach(day => {
      totalSales += day.netSales;
      totalOrders += day.orders;
      totalGst += day.tax;
      totalCancelledOrders += day.cancelledOrders;
      totalCancelledAmount += day.cancelledAmount;
    });

    res.json({
      totalSales: Number(totalSales.toFixed(2)),
      totalOrders,
      totalGst: Number(totalGst.toFixed(2)),
      totalCancelledOrders,
      totalCancelledAmount: Number(totalCancelledAmount.toFixed(2)),
      dailyBreakdown
    });

  } catch (error) {
    console.error('Reports Summary Error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getSummaryReport };