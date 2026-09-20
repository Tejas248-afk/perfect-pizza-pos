const express = require('express');
const router = express.Router();
const Order = require('../models/Order');

// GET /api/reports/summary?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get('/summary', async (req, res) => {
  try {
    let { startDate, endDate } = req.query;

    const todayStr = new Date().toISOString().split('T')[0];
    if (!startDate) startDate = todayStr;
    if (!endDate) endDate = todayStr;

    // Start of startDay (00:00:00.000)
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    // End of endDay (23:59:59.999)
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // 🔥 Match all non-cancelled orders in date range (Includes new, preparing, ready, completed)
    const query = {
      createdAt: { $gte: start, $lte: end },
      status: { $ne: 'cancelled' } 
    };

    const orders = await Order.find(query);

    let totalSales = 0;
    let totalGst = 0;
    let paymentSplit = { upi: 0, cash: 0, card: 0 };
    let orderTypeSplit = { delivery: 0, takeaway: 0, 'dine-in': 0 };
    let productMap = {};

    orders.forEach(o => {
      const gTotal = Number(o.grandTotal) || 0;
      totalSales += gTotal;
      totalGst += Number(o.gstAmount) || 0;

      // Payment Method Split
      let payMethod = (o.paymentMethod || 'cash').toLowerCase();
      if (payMethod === 'pending') payMethod = 'cash'; // Default fallback for pending dine-in
      
      if (paymentSplit[payMethod] !== undefined) {
        paymentSplit[payMethod] += gTotal;
      } else {
        paymentSplit.cash += gTotal;
      }

      // Order Type Split
      const type = (o.orderType || 'takeaway').toLowerCase();
      if (orderTypeSplit[type] !== undefined) {
        orderTypeSplit[type] += 1;
      } else {
        orderTypeSplit.takeaway += 1;
      }

      // Top Selling Products Calculation
      (o.items || []).forEach(item => {
        const pName = item.productName || item.product?.name || 'Item';
        const qty = Number(item.qty) || 1;
        const unitPrice = (Number(item.basePrice) || 0) + (Number(item.crustPrice) || 0) + (Number(item.addonsTotal) || 0);
        const revenue = unitPrice * qty;

        if (!productMap[pName]) {
          productMap[pName] = { name: pName, qty: 0, revenue: 0 };
        }
        productMap[pName].qty += qty;
        productMap[pName].revenue += revenue;
      });
    });

    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;

    const topProducts = Object.values(productMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    res.json({
      totalSales: Math.round(totalSales),
      totalOrders,
      averageOrderValue,
      totalGst: Number(totalGst.toFixed(2)),
      paymentSplit,
      orderTypeSplit,
      topProducts
    });
  } catch (err) {
    console.error("❌ Report Calculation Error:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;