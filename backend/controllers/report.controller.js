const Order = require('../models/Order');

// @desc    Get Sales Summary & Analytics
// @route   GET /api/reports/summary
// @access  Private (Admin / Super-Admin)
const getSummaryReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Default to today if dates not provided
    const now = new Date();
    const defaultDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    
    const sDateStr = startDate || defaultDateStr;
    const eDateStr = endDate || defaultDateStr;

    // Broad UTC range to ensure no timezone edge cases are missed in DB query
    const broadStart = new Date(`${sDateStr}T00:00:00.000Z`);
    broadStart.setDate(broadStart.getDate() - 1); // 1 day buffer before

    const broadEnd = new Date(`${eDateStr}T23:59:59.999Z`);
    broadEnd.setDate(broadEnd.getDate() + 1); // 1 day buffer after

    let filter = {
      createdAt: { $gte: broadStart, $lte: broadEnd }
    };

    // Safe Branch Filter (Order fetch block na ho agar branch null ho)
    if (req.user && req.user.branch) {
      const branchId = req.user.branch._id || req.user.branch;
      if (branchId) {
        filter.$or = [
          { branch: branchId },
          { branch: { $exists: false } },
          { branch: null }
        ];
      }
    }

    const rawOrders = await Order.find(filter).lean();
    console.log(`📊 Reports Log: Found ${rawOrders.length} raw orders in DB.`);

    // Strict Indian Standard Time (IST) Date Filtering (YYYY-MM-DD)
    const allOrders = rawOrders.filter(order => {
      if (!order.createdAt) return false;
      const orderISTDate = new Date(order.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      return orderISTDate >= sDateStr && orderISTDate <= eDateStr;
    });

    console.log(`📊 Reports Log: ${allOrders.length} orders matched exact IST range (${sDateStr} to ${eDateStr}).`);

    let totalSales = 0;
    let totalOrders = 0;
    let totalGst = 0;
    let totalDiscount = 0;
    let totalDelivery = 0;
    let totalSubTotal = 0;

    let totalCancelledOrders = 0;
    let totalCancelledAmount = 0;

    const dailyMap = {};

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