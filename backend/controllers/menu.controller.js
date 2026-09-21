const Category = require('../models/Category');
const Product = require('../models/Product');
const Crust = require('../models/Crust');
const Addon = require('../models/Addon');

// Safe branch helper
const getBranchId = (req) => {
  if (!req.user || !req.user.branch) return null;
  return req.user.branch._id || req.user.branch;
};

// ===================== GET FULL MENU =====================
const getFullMenu = async (req, res) => {
  try {
    const branchId = getBranchId(req);
    const filter = branchId ? { branch: branchId } : {};

    const categories = await Category.find(filter).sort({ displayOrder: 1, createdAt: 1 });
    const products = await Product.find(filter).sort({ displayOrder: 1, createdAt: 1 });
    const crusts = await Crust.find(filter);
    const addons = await Addon.find(filter);

    res.json({ categories, products, crusts, addons });
  } catch (error) {
    console.error('❌ Error in getFullMenu:', error);
    res.status(500).json({ message: error.message });
  }
};

// ===================== PRODUCTS CRUD =====================
const addProduct = async (req, res) => {
  try {
    const branchId = getBranchId(req);
    const product = new Product({
      ...(branchId ? { branch: branchId } : {}),
      ...req.body,
    });
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    console.error('addProduct Error:', error);
    res.status(500).json({ message: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const toggleProductAvailability = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    product.isAvailable = !product.isAvailable;
    await product.save();
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===================== CATEGORIES CRUD =====================
const addCategory = async (req, res) => {
  try {
    const branchId = getBranchId(req);
    const { name, icon, displayOrder } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const category = new Category({
      name: String(name).trim(),
      icon: icon || '🍕',
      displayOrder: displayOrder || 0,
      ...(branchId ? { branch: branchId } : {}),
    });

    await category.save();
    res.status(201).json(category);
  } catch (error) {
    console.error('addCategory Error:', error);
    // Duplicate name etc.
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Category already exists' });
    }
    res.status(500).json({ message: error.message });
  }
};

const updateCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    // Category ke saath uske products bhi delete
    await Product.deleteMany({ category: req.params.id });

    res.json({ message: 'Category & products deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===================== CRUSTS CRUD =====================
const addCrust = async (req, res) => {
  try {
    const branchId = getBranchId(req);
    const crust = new Crust({
      ...(branchId ? { branch: branchId } : {}),
      ...req.body,
    });
    await crust.save();
    res.status(201).json(crust);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateCrust = async (req, res) => {
  try {
    const crust = await Crust.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!crust) return res.status(404).json({ message: 'Crust not found' });
    res.json(crust);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteCrust = async (req, res) => {
  try {
    const crust = await Crust.findByIdAndDelete(req.params.id);
    if (!crust) return res.status(404).json({ message: 'Crust not found' });
    res.json({ message: 'Crust deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===================== ADDONS CRUD =====================
const addAddon = async (req, res) => {
  try {
    const branchId = getBranchId(req);
    const addon = new Addon({
      ...(branchId ? { branch: branchId } : {}),
      ...req.body,
    });
    await addon.save();
    res.status(201).json(addon);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateAddon = async (req, res) => {
  try {
    const addon = await Addon.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!addon) return res.status(404).json({ message: 'Addon not found' });
    res.json(addon);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteAddon = async (req, res) => {
  try {
    const addon = await Addon.findByIdAndDelete(req.params.id);
    if (!addon) return res.status(404).json({ message: 'Addon not found' });
    res.json({ message: 'Addon deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getFullMenu,
  addProduct,
  updateProduct,
  deleteProduct,
  toggleProductAvailability,
  addCategory,
  updateCategory,
  deleteCategory,
  addCrust,
  updateCrust,
  deleteCrust,
  addAddon,
  updateAddon,
  deleteAddon,
};