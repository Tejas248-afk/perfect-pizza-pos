require('dotenv').config();
const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');

const MONGO_URI = process.env.MONGO_URI || process.env.DB_URI;

if (!MONGO_URI) {
  console.error("❌ Error: MONGO_URI .env file me nahi mila!");
  process.exit(1);
}

// Mongoose Schema with Address
const customerSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  name: { type: String, default: 'Guest' },
  address: { type: String, default: '' },
  rewardCoins: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
}, { timestamps: true });

const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);

async function importExcelData() {
  try {
    console.log("⏳ Connecting to MongoDB Atlas...");
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas Cloud!');

    const filePath = path.join(__dirname, 'customers.xlsx');
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    console.log(`📦 Total rows found in Excel: ${rawData.length}`);

    // 🔥 SAMPLE PRINT: Pehle 2 rows terminal me dikhayega
    if (rawData.length > 0) {
      console.log("\n🔍 Sample Excel Row 1:", rawData[0]);
    }

    let importedCount = 0;
    let updatedCount = 0;

    for (const row of rawData) {
      // Excel Column Names Flexible Match
      let phoneInput = null, nameVal = 'Guest', addressVal = '';

      for (let key of Object.keys(row)) {
        const k = key.toLowerCase().trim();
        if (k.includes('phone') || k.includes('mobile') || k.includes('number')) {
          phoneInput = row[key];
        }
        if (k.includes('name')) {
          nameVal = row[key];
        }
        if (k.includes('address') || k.includes('location') || k.includes('pata') || k.includes('addr')) {
          addressVal = row[key];
        }
      }

      if (!phoneInput) continue;

      let phoneStr = String(phoneInput).replace(/[^0-9]/g, '');
      if (phoneStr.length >= 10) {
        phoneStr = phoneStr.slice(-10);
      } else {
        continue;
      }

      const customerData = {
        name: String(nameVal || 'Guest').trim(),
        address: String(addressVal || '').trim(),
        rewardCoins: Number(row.rewardCoins || row.coins) || 0,
        totalOrders: Number(row.totalOrders || row.orders) || 0,
        totalSpent: Number(row.totalSpent || row.spent) || 0,
      };

      const res = await Customer.updateOne(
        { phone: phoneStr },
        { $set: customerData },
        { upsert: true }
      );

      if (res.upsertedCount > 0) importedCount++;
      else updatedCount++;
    }

    console.log(`\n🎉 IMPORT FINISHED SUCCESSFULLY!`);
    console.log(`✨ Added New: ${importedCount}`);
    console.log(`🔄 Updated Existing: ${updatedCount}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Import Failed:', error.message);
    process.exit(1);
  }
}

importExcelData();