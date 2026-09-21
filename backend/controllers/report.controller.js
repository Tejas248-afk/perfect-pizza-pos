const Order = require('../models/Order');

// @desc    Get Sales Summary & Analytics
// @route   GET /api/reports/summary
// @access  Private (Admin / Super-Admin)
const getSummaryReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Helper: IST Date string (YYYY-MM-DD)
    const getISTDateStr = (dObj) => {
      const istTime = new Date(new Date(dObj).getTime() + (5.5 * 60 * 60 * 1000));
      return istTime.toISOString().split('T')[0];
    };

    // Default to today in IST
    const todayIST = getISTDateStr(new Date());
    const sDateStr = startDate || todayIST;
    const eDateStr = endDate || todayIST;

    // Parse IST start and end into UTC Date objects for Mongo Query
    const startTime = new Date(`${sDateStr}T00:00:00.000+05:30`);
    const endTime = new Date(`${eDateStr}T23:59:59.999+05:30`);

    // Fetch orders in date range (Branch restriction removed so no orders get blocked)
    const rawOrders = await Order.find({
      createdAt: { $gte: startTime, $lte: endTime }
    }).sort({ createdAt: -1 }).lean();

    console.log(`📊 Report Query: ${sDateStr} to ${eDateStr} | Found ${rawOrders.length} orders.`);

    let totalSales = 0;
    let totalOrders = 0;
    let totalGst = 0;
    let totalDiscount = 0;
    let totalDelivery = 0;
    let totalSubTotal = 0;

    let totalCancelledOrders = 0;
    let totalCancelledAmount = 0;

    const dailyMap = {};

    rawOrders.forEach((order) => {
      const dateKey = getISTDateStr(order.createdAt);
      
      // Formatted Label like "20 Sep, 2026"
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
          tax: 0,
          discount: 0,
          charges: 0,
          grossSales: 0,
          cancelledAmount: 0,
          cancelledOrders: 0,
          netSales: 0,
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
        totalCancelledOrders += 1;
        totalCancelledAmount += grand;

        day.cancelledOrders += 1;
        day.cancelledAmount += grand;
      } else {
        totalOrders += 1;
        totalSales += grand;
        totalGst += gst;
        totalDiscount += discount;
        totalDelivery += delivery;
        totalSubTotal += subTotal;

        day.orders += 1;
        day.subTotal += subTotal;
        day.tax += gst;
        day.discount += discount;
        day.charges += delivery;
        day.grossSales += grand;
        day.netSales += grand;
      }
    });

    const dailyBreakdown = Object.values(dailyMap).sort((a, b) => b.dateKey.localeCompare(a.dateKey));

    res.json({
      totalSales: Number(totalSales.toFixed(2)),
      totalOrders,
      averageOrderValue: totalOrders ? Math.round(totalSales / totalOrders) : 0,
      totalGst: Number(totalGst.toFixed(2)),
      totalCancelledOrders,
      totalCancelledAmount: Number(totalCancelledAmount.toFixed(2)),
      dailyBreakdown,
    });
  } catch (error) {
    console.error('Report Error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getSummaryReport };