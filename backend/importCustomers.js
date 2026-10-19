require('dotenv').config();
const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');
const Customer = require('./models/Customer');
const Branch = require('./models/Branch');

const MONGO_URI = process.env.MONGO_URI || process.env.DB_URI;

async function main() {
  try {
    if (!MONGO_URI) {
      throw new Error('MONGO_URI is not defined in .env file');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB!');

    const branch = (await Branch.findOne({ code: 'PP-KLP' })) || (await Branch.findOne());
    if (!branch) {
      throw new Error('Branch not found. Please run seedAdmin.js first!');
    }

    const filePath = path.join(__dirname, 'customers.xlsx');
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    console.log(`Total rows found in Excel: ${rawData.length}`);

    const operationsMap = new Map();

    for (const row of rawData) {
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
        branch: branch._id,
        name: String(nameVal || 'Guest').trim(),
        address: String(addressVal || '').trim(),
        rewardCoins: Number(row.rewardCoins || row.coins) || 0,
        totalOrders: Number(row.totalOrders || row.orders) || 0,
        totalSpent: Number(row.totalSpent || row.spent) || 0,
      };

      operationsMap.set(phoneStr, customerData);
    }

    const bulkOps = [];
    for (const [phoneStr, customerData] of operationsMap.entries()) {
      bulkOps.push({
        updateOne: {
          filter: { phone: phoneStr },
          update: { $set: customerData },
          upsert: true
        }
      });
    }

    console.log(`Processing ${bulkOps.length} unique phone records in bulk...`);

    let importedCount = 0;
    let updatedCount = 0;

    if (bulkOps.length > 0) {
      const res = await Customer.bulkWrite(bulkOps);
      importedCount = res.upsertedCount || 0;
      updatedCount = res.modifiedCount || 0;
    }

    console.log(`\nIMPORT FINISHED SUCCESSFULLY!`);
    console.log(`Total Unique Records Processed: ${bulkOps.length}`);
    console.log(`Added New: ${importedCount}`);
    console.log(`Updated/Matched Existing: ${updatedCount}`);

    process.exit(0);
  } catch (error) {
    console.error('Error during customer import:', error);
    process.exit(1);
  }
}

main();
