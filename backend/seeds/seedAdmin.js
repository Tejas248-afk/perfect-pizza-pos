const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Branch = require('../models/Branch');
const User = require('../models/User');

// Load env file using absolute path
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const seedData = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined in .env file');
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB for seeding...');

    // 1. Create Default Branch
    let branch = await Branch.findOne({ code: 'PP-KLP' });
    if (!branch) {
      branch = await Branch.create({
        name: 'Perfect Pizza - Kalyanpur',
        code: 'PP-KLP',
        address: 'Singhpur Chauraha, Bithoor Road, Kalyanpur, Kanpur Nagar',
        phone: '+91 9889229198',
        whatsapp: '+91 7800775619',
        gstNumber: '09BCVPDD4203L2ZB',
      });
      console.log('✅ Branch Created:', branch.name);
    } else {
      console.log('ℹ️ Branch already exists:', branch.name);
    }

    // 2. Create Super Admin User
    const adminPhone = '9889229198';
    let admin = await User.findOne({ phone: adminPhone });

    if (!admin) {
      admin = await User.create({
        name: 'Perfect Pizza Owner',
        phone: adminPhone,
        email: 'admin@perfectpizzas.in',
        password: 'admin123', // Will be hashed automatically
        role: 'super-admin',
        branch: branch._id,
      });
      console.log('✅ Super Admin Created!');
      console.log('   Phone:', adminPhone);
      console.log('   Password: admin123');
    } else {
      console.log('ℹ️ Super Admin already exists!');
    }

    console.log('\n🎉 Seeding Completed Successfully!');
    process.exit();
  } catch (error) {
    console.error('❌ Error Seeding Data:', error.message);
    process.exit(1);
  }
};

seedData();