const Order = require('../models/Order');

// @desc    Get Sales Summary & Analytics (Zero-Fail Logic)
// @route   GET /api/reports/summary
// @access  Private (Admin / Super-Admin)
const getSummaryReport = async (req, res) => {
  try {
    // 1. Database se saare orders uthao (Bina kisi strict Mongo date restriction ke)
    const allDbOrders = await Order.find({}).sort({ createdAt: -1 }).lean();

    console.log(`📊 DB Log: Total orders in Database = ${allDbOrders ? allDbOrders.length : 0}`);

    if (!allDbOrders || allDbOrders.length === 0) {
      return res.json({
        totalSales: 0,
        totalOrders: 0,
        totalGst: 0,
        totalCancelledOrders: 0,
        totalCancelledAmount: 0,
        dailyBreakdown: []
      });
    }

    const { startDate, endDate } = req.query;

    // Helper: Convert any Date object to Indian YYYY-MM-DD
    const toISTYYYYMMDD = (d) => {
      if (!d) return '';
      const dateObj = new Date(d);
      if (isNaN(dateObj.getTime())) return '';
      const istDate = new Date(dateObj.getTime() + (5.5 * 60 * 60 * 1000));
      return istDate.toISOString().split('T')[0];
    };

    // 2. Filter orders in pure JavaScript
    let ordersToProcess = allDbOrders;

    if (startDate && endDate && startDate.trim() !== '' && endDate.trim() !== '') {
      ordersToProcess = allDbOrders.filter(order => {
        const orderDateStr = toISTYYYYMMDD(order.createdAt);
        return orderDateStr >= startDate && orderDateStr <= endDate;
      });
    }

    // 3. Process Daily Breakdown
    const dailyMap = {};

    ordersToProcess.forEach(order => {
      const dateKey = toISTYYYYMMDD(order.createdAt) || 'Unknown Date';
      
      const istObj = new Date(new Date(order.createdAt).getTime() + (5.5 * 60 * 60 * 1000));
      const dateLabel = !isNaN(istObj.getTime()) 
        ? istObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : dateKey;

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

    const dailyBreakdown = Object.values(dailyMap).sort((a, b) => b.dateKey.localeCompare(a.dateKey));

    // 4. Calculate Totals
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
    console.error('Report Error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getSummaryReport };