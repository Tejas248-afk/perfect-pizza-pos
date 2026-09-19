const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

const Branch = require('../models/Branch');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Crust = require('../models/Crust');
const Addon = require('../models/Addon');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const seedMenu = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB for Menu Seeding...');

    const branch = await Branch.findOne({ code: 'PP-KLP' });
    if (!branch) {
      throw new Error('Branch not found. Please run "npm run seed" first.');
    }

    const branchId = branch._id;

    // Clear old menu data
    await Category.deleteMany({ branch: branchId });
    await Product.deleteMany({ branch: branchId });
    await Crust.deleteMany({ branch: branchId });
    await Addon.deleteMany({ branch: branchId });
    console.log('🧹 Cleared existing menu items...');

    // 1. Seed Crusts
    await Crust.create([
      { branch: branchId, name: 'Cheese Burst', extraPrice: { regular: 50, medium: 80 } },
      { branch: branchId, name: 'Thin Crust', extraPrice: { regular: 20, medium: 35 } },
    ]);
    console.log('✅ Crusts Seeded');

    // 2. Seed Addons
    await Addon.create([
      { branch: branchId, name: 'Extra Cheese', prices: { regular: 30, medium: 50, large: 65 } },
      { branch: branchId, name: 'Veg Topping', prices: { regular: 20, medium: 35, large: 50 } },
    ]);
    console.log('✅ Addons Seeded');

    // 3. Seed Categories & Products
    const menuStructure = [
      {
        category: 'Cheesy Pizza Mania',
        icon: '🧀',
        order: 1,
        hasSizes: true,
        hasCrust: true,
        hasAddons: true,
        items: [
          { name: 'Cheese Paneer Pizza', prices: { regular: 130, medium: 250, large: 420 } },
          { name: 'Paneer & Corn Pizza', prices: { regular: 140, medium: 270, large: 440 } },
          { name: 'Paneer Red Heat Pizza', prices: { regular: 150, medium: 300, large: 440 }, isSpicy: true },
          { name: 'Mushroom Pizza', prices: { regular: 130, medium: 250, large: 420 } },
          { name: 'Cheese Capsicum Pizza', prices: { regular: 110, medium: 210, large: 330 } },
          { name: 'Sweet Corn Pizza', prices: { regular: 110, medium: 210, large: 330 } },
          { name: 'Cheese Tomato Pizza', prices: { regular: 100, medium: 200, large: 320 } },
          { name: 'Cheese Onion Pizza', prices: { regular: 100, medium: 200, large: 320 } },
        ],
      },
      {
        category: 'Premium Pizza Mania',
        icon: '⭐',
        order: 2,
        hasSizes: true,
        hasCrust: true,
        hasAddons: true,
        items: [
          { name: 'Veggi Special Pizza', desc: 'Onion, Capsicum, Tomato', prices: { regular: 130, medium: 240, large: 370 } },
          { name: 'Single Cheese Margherita', desc: 'Single Layer Mozzarella', prices: { regular: 130, medium: 240, large: 370 } },
          { name: 'Spring Filling Pizza', desc: 'Corn & Tomato', prices: { regular: 130, medium: 240, large: 370 } },
          { name: 'Country Side Pizza', desc: 'Capsicum, Jalapeno, Black Olive', prices: { regular: 130, medium: 240, large: 370 } },
          { name: 'Italian Pizza', desc: 'Onion, Corn, Black Olives', prices: { regular: 130, medium: 240, large: 370 } },
          { name: 'Punjabi Pizza', desc: 'Paneer & Capsicum', prices: { regular: 140, medium: 260, large: 390 }, isSpicy: true },
          { name: 'Tandoori Twist Pizza', desc: 'Paneer & Red Pepper', prices: { regular: 140, medium: 260, large: 390 }, isSpicy: true },
          { name: 'Veg Loaded Pizza', desc: 'Onion, Tomato, Capsicum, Corn, Mushroom', prices: { regular: 150, medium: 310, large: 450 } },
        ],
      },
      {
        category: 'Exotic Veg',
        icon: '🌿',
        order: 3,
        hasSizes: true,
        hasCrust: true,
        hasAddons: true,
        items: [
          { name: 'Paneer Pepper Pizza', desc: 'Paneer, Red Pepper, Capsicum', prices: { regular: 170, medium: 320, large: 460 } },
          { name: 'Cheese Corn Pizza', desc: 'Cheese & Corn Flavours', prices: { regular: 170, medium: 320, large: 460 } },
          { name: 'Garden Fresh Pizza', desc: 'Onion, Capsicum, Tomato, Mushroom', prices: { regular: 170, medium: 320, large: 460 } },
          { name: 'Green Maxicana Pizza', desc: 'Onion, Capsicum, Paneer, Jalapeno', prices: { regular: 170, medium: 320, large: 460 } },
          { name: 'Veg Delight Pizza', desc: 'Onion, Capsicum, Corn, Paneer, Mushroom', prices: { regular: 170, medium: 320, large: 460 } },
          { name: 'Double Cheese Margherita', desc: 'Pure 100% Mozzarella Loaded with Extra Cheese', prices: { regular: 170, medium: 320, large: 460 } },
        ],
      },
      {
        category: 'Veg Special',
        icon: '🌶️',
        order: 4,
        hasSizes: true,
        hasCrust: true,
        hasAddons: true,
        items: [
          { name: 'Tangy Spice Pizza', desc: 'RedPepper, Capsicum, Jalapeno, Onion', prices: { regular: 210, medium: 400, large: 560 }, isSpicy: true },
          { name: 'Amritsari Pizza', desc: 'Paneer, Onion, Black Olive, Capsicum', prices: { regular: 210, medium: 400, large: 560 } },
          { name: 'Makhani Paneer Tikka Pizza', desc: 'Onion, RedPepper, Paneer Tikka', prices: { regular: 210, medium: 400, large: 560 }, isSpicy: true },
          { name: 'Cheesy Paneer Pizza', desc: 'Corn, Paneer, Mushroom', prices: { regular: 210, medium: 400, large: 560 } },
          { name: 'Tandoori Paneer Pizza', desc: 'Onion, Capsicum, Paneer, RedPepper', prices: { regular: 210, medium: 400, large: 560 }, isSpicy: true },
          { name: 'Super Spicy Pizza', desc: 'RedPepper, YellowPepper, Capsicum, RedPepper, Jalapeno', prices: { regular: 210, medium: 400, large: 560 }, isSpicy: true },
          { name: 'Veg Supreme Pizza', desc: 'Onion, Capsicum, Tomato, Corn, Black Olives, Jalapeno', prices: { regular: 210, medium: 400, large: 560 } },
        ],
      },
      {
        category: 'PP Special',
        icon: '👑',
        order: 5,
        hasSizes: true,
        hasCrust: true,
        hasAddons: true,
        items: [
          { name: 'Perfect Pizza Special Pizza', desc: 'Onion, Capsicum, Paneer, Mushroom, Black Olives', prices: { regular: 230, medium: 430, large: 590 } },
        ],
      },
      {
        category: 'Pizza Menia 7" Pizza',
        icon: '🍕',
        order: 6,
        hasSizes: false,
        hasCrust: false,
        hasAddons: true,
        items: [
          { name: 'Paneer & Onion Pizza 7"', prices: { single: 110 } },
          { name: 'Onion & Capsicum Pizza 7"', prices: { single: 100 } },
          { name: 'Tomato & Corn Pizza 7"', prices: { single: 100 } },
          { name: 'Jalapeno Onion Pizza 7"', prices: { single: 110 } },
          { name: 'Capsicum Pizza 7" (Double Topping)', prices: { single: 80 } },
          { name: 'Corn Pizza 7" (Double Topping)', prices: { single: 80 } },
          { name: 'Onion Pizza 7" (Single Topping)', prices: { single: 70 } },
          { name: 'Tomato Pizza 7" (Single Topping)', prices: { single: 70 } },
        ],
      },
      {
        category: 'Side Order / Dessert',
        icon: '🍟',
        order: 7,
        hasSizes: false,
        items: [
          { name: 'Stuffed Bread Cheesy (6 Sticks)', prices: { single: 110 } },
          { name: 'Garlic Bread (8 Sticks)', prices: { single: 70 } },
          { name: 'Calzone Pocket', prices: { single: 110 } },
          { name: 'Chocolava Cake', prices: { single: 70 } },
          { name: 'Red Pasta', prices: { single: 100 } },
          { name: 'White Pasta', prices: { single: 100 } },
          { name: 'Zingy Parcel (2 Pcs)', prices: { single: 80 } },
          { name: 'Hot Coffee', prices: { single: 40 } },
        ],
      },
      {
        category: 'Burgers',
        icon: '🍔',
        order: 8,
        hasSizes: false,
        items: [
          { name: 'Aloo Tikki Burger', prices: { single: 60 } },
          { name: 'Veg Tikki Burger', prices: { single: 80 } },
          { name: 'Paneer Tikki Burger', prices: { single: 100 } },
          { name: 'Classic Cheese Burger', prices: { single: 120 } },
          { name: 'Tandoori Cheese Paneer Burger', prices: { single: 135 } },
          { name: 'Makhani Cheese Paneer Burger', prices: { single: 135 } },
        ],
      },
      {
        category: 'Maggies',
        icon: '🍜',
        order: 9,
        hasSizes: false,
        items: [
          { name: 'Plain Maggie', prices: { single: 60 } },
          { name: 'Butter Maggie', prices: { single: 80 } },
          { name: 'Veggies Maggie', prices: { single: 100 } },
          { name: 'Paneer Maggie', prices: { single: 100 } },
          { name: 'Corn Maggie', prices: { single: 100 } },
          { name: 'Cheese Veggies Maggie', prices: { single: 120 } },
        ],
      },
      {
        category: 'Super Saving Combo',
        icon: '🎁',
        order: 10,
        hasSizes: false,
        items: [
          { name: 'Zingy Pizza Combo', desc: 'Onion Pizza, 2 Zingy Parcel, ColdDrink 250ml', prices: { single: 140 } },
          { name: 'Garlic Pizza Combo', desc: 'Paneer Onion Pizza, 1 Garlic Bread, ColdDrink 250ml', prices: { single: 170 } },
          { name: 'Pizza Pasta Combo', desc: 'Italian Pizza(Reg), Red Pasta, ColdDrink 250ml', prices: { single: 220 } },
          { name: 'Meal For 2', desc: '2 Single Topping Pizza, 1 Garlic Bread, ColdDrink 250ml', prices: { single: 210 } },
          { name: 'Meal For 3', desc: '3 Single Topping Pizza, 1 Garlic Bread, 1 Chocolava, ColdDrink 1L', prices: { single: 380 } },
          { name: '4 Single Topping Pizza Combo [Reg] + ColdDrink 1L', desc: 'Onion, Capsicum, Tomato, Corn', prices: { single: 300 } },
          { name: '4 Double Topping Pizza Combo [Reg] + ColdDrink 1L', desc: 'Paneer Onion, Tomato Corn, Jalapeno Onion, Onion Capsicum', prices: { single: 360 } },
          { name: '4 Special Pizza Combo [Reg] + ColdDrink 1L', desc: 'Cheese Paneer, Veg Loaded, Country Side, Cheese Corn', prices: { single: 580 } },
          { name: '3 Paneer Pizza Combo [Reg] + ColdDrink 1L', desc: 'Cheese Paneer, Punjabi Pizza, Paneer Corn', prices: { single: 420 } },
          { name: '3 Special Paneer Pizza [Reg] Combo + ColdDrink 1L', desc: 'Tandoori Paneer + Makhani Paneer + Punjabi Pizza + ColdDrink 1L', prices: { single: 565 } },
          { name: '2 Special Pizza [Reg] Combo + ColdDrink 1L', desc: 'Spring Filling Pizza + Veg Delight Pizza + ColdDrink 1L', prices: { single: 320 } },
          { name: '3 Single Topping Pizza [Reg] Combo + ColdDrink 1L', prices: { single: 220 } },
          { name: '3 Double Topping Pizza [Reg] Combo + ColdDrink 1L', prices: { single: 310 } },
          { name: '2 Single Topping Pizza [Reg] Combo + ColdDrink 1L', prices: { single: 160 } },
          { name: '2 Double Topping Pizza [Reg] Combo + ColdDrink 1L', prices: { single: 220 } },
          { name: '4 Pizza Set Single Topping', prices: { single: 270 } },
          { name: '4 Pizza Set Double Topping', prices: { single: 390 } },
          { name: '6 Pizza Set Single Topping', prices: { single: 399 } },
          { name: '6 Pizza Set Double Topping', prices: { single: 590 } },
        ],
      },
      {
        category: 'Everyday Combos',
        icon: '💰',
        order: 11,
        hasSizes: false,
        items: [
          { name: 'Combo-A (Rs 99)', desc: 'Onion Capsicum/ Tomato Corn, ColdDrink 250ml', prices: { single: 99 } },
          { name: 'Combo-B (Rs 99)', desc: 'Cheese Onion/ Tomato, ColdDrink 250ml', prices: { single: 99 } },
          { name: 'Combo-C (Rs 99)', desc: 'Cheese Corn/ Capsicum, ColdDrink 250ml', prices: { single: 99 } },
          { name: 'Combo-D (Rs 149)', desc: 'Corn Pizza, Capsicum Pizza, ColdDrink 250ml', prices: { single: 149 } },
          { name: 'Combo-E (Rs 149)', desc: 'Tomato Corn Pizza, Tomato Pizza, ColdDrink 250ml', prices: { single: 149 } },
          { name: 'Combo-F (Rs 149)', desc: 'Tomato Corn Pizza, Tomato Pizza, ColdDrink 250ml', prices: { single: 149 } },
          { name: 'Combo-G (Rs 149)', desc: 'Tomato Corn Pizza, Tomato Pizza, ColdDrink 250ml', prices: { single: 149 } },
          { name: 'Combo-H (Rs 149)', desc: 'Calzone Pocket, Onion Pizza, ColdDrink 250ml', prices: { single: 149 } },
          { name: 'Burger Pizza Combo (Rs 149)', desc: 'Paneer Onion Pizza, Burger, ColdDrink 250ml', prices: { single: 149 } },
        ],
      },
    ];

    for (const catData of menuStructure) {
      const category = await Category.create({
        branch: branchId,
        name: catData.category,
        icon: catData.icon,
        displayOrder: catData.order,
      });

      for (const item of catData.items) {
        await Product.create({
          branch: branchId,
          category: category._id,
          name: item.name,
          description: item.desc || '',
          hasSizes: catData.hasSizes,
          prices: item.prices,
          hasCrust: catData.hasCrust || false,
          hasAddons: catData.hasAddons || false,
          isSpicy: item.isSpicy || false,
        });
      }
      console.log(`  └─ Category "${catData.category}" seeded with ${catData.items.length} items`);
    }

    console.log('\n🎉 Complete Menu Seeded Successfully!');
    process.exit();
  } catch (error) {
    console.error('❌ Error Seeding Menu:', error.message);
    process.exit(1);
  }
};

seedMenu();