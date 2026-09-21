const express = require('express');
const router = express.Router();

const {
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
} = require('../controllers/menu.controller'); // path apne project ke hisaab se

const { protect, authorize } = require('../middleware/auth.middleware');

// Admin only helper
const adminOnly = [protect, authorize('super-admin', 'admin')];

// ========== FULL MENU ==========
// GET /api/menu
router.get('/', getFullMenu);

// ========== CATEGORIES ==========
// POST   /api/menu/categories
// PUT    /api/menu/categories/:id
// DELETE /api/menu/categories/:id
router.post('/categories', ...adminOnly, addCategory);
router.put('/categories/:id', ...adminOnly, updateCategory);
router.patch('/categories/:id', ...adminOnly, updateCategory);
router.delete('/categories/:id', ...adminOnly, deleteCategory);

// ========== PRODUCTS ==========
// POST   /api/menu/products
// PUT    /api/menu/products/:id
// DELETE /api/menu/products/:id
// PATCH  /api/menu/products/:id/toggle
router.post('/products', ...adminOnly, addProduct);
router.put('/products/:id', ...adminOnly, updateProduct);
router.patch('/products/:id', ...adminOnly, updateProduct);
router.delete('/products/:id', ...adminOnly, deleteProduct);
router.patch('/products/:id/toggle', ...adminOnly, toggleProductAvailability);

// ========== CRUSTS ==========
router.post('/crusts', ...adminOnly, addCrust);
router.put('/crusts/:id', ...adminOnly, updateCrust);
router.patch('/crusts/:id', ...adminOnly, updateCrust);
router.delete('/crusts/:id', ...adminOnly, deleteCrust);

// ========== ADDONS ==========
router.post('/addons', ...adminOnly, addAddon);
router.put('/addons/:id', ...adminOnly, updateAddon);
router.patch('/addons/:id', ...adminOnly, updateAddon);
router.delete('/addons/:id', ...adminOnly, deleteAddon);

module.exports = router;