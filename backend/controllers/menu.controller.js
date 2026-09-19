const Category = require('../models/Category');
const Product = require('../models/Product');
const Crust = require('../models/Crust');
const Addon = require('../models/Addon');

// ===================== GET FULL MENU =====================
const getFullMenu = async (req, res) => {
  try {
    let branchId = null;
    if (req.user && req.user.branch) {
      branchId = req.user.branch._id || req.user.branch;
    }

    const filter = branchId ? { branch: branchId } : {};

    const categories = await Category.find(filter).sort({ displayOrder: 1 });
    const products = await Product.find(filter).sort({ displayOrder: 1 });
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
    const branchId = req.user.branch._id || req.user.branch;
    const product = new Product({ branch: branchId, ...req.body });
    await product.save();
    res.json(product);
  } catch (error) { 
    console.error('addProduct Error:', error);
    res.status(500).json({ message: error.message }); 
  }
};

const updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(product);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const deleteProduct = async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const toggleProductAvailability = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    product.isAvailable = !product.isAvailable;
    await product.save();
    res.json(product);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

// ===================== CATEGORIES CRUD =====================
const addCategory = async (req, res) => {
  try {
    const branchId = req.user.branch._id || req.user.branch;
    const category = new Category({ branch: branchId, ...req.body });
    await category.save();
    res.json(category);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const updateCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(category);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const deleteCategory = async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    await Product.deleteMany({ category: req.params.id });
    res.json({ message: 'Category & products deleted' });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

// ===================== CRUSTS CRUD =====================
const addCrust = async (req, res) => {
  try {
    const branchId = req.user.branch._id || req.user.branch;
    const crust = new Crust({ branch: branchId, ...req.body });
    await crust.save();
    res.json(crust);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const updateCrust = async (req, res) => {
  try {
    const crust = await Crust.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(crust);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const deleteCrust = async (req, res) => {
  try {
    await Crust.findByIdAndDelete(req.params.id);
    res.json({ message: 'Crust deleted' });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

// ===================== ADDONS CRUD =====================
const addAddon = async (req, res) => {
  try {
    const branchId = req.user.branch._id || req.user.branch;
    const addon = new Addon({ branch: branchId, ...req.body });
    await addon.save();
    res.json(addon);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const updateAddon = async (req, res) => {
  try {
    const addon = await Addon.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(addon);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const deleteAddon = async (req, res) => {
  try {
    await Addon.findByIdAndDelete(req.params.id);
    res.json({ message: 'Addon deleted' });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

module.exports = {
  getFullMenu,
  addProduct, updateProduct, deleteProduct, toggleProductAvailability,
  addCategory, updateCategory, deleteCategory,
  addCrust, updateCrust, deleteCrust,
  addAddon, updateAddon, deleteAddon
};