const CafeSetting = require('../models/CafeSetting');
const User = require('../models/User');
const Branch = require('../models/Branch');

// ---------- SETTINGS ----------
const getSettings = async (req, res) => {
  try {
    const branchId = req.user.branch._id || req.user.branch;

    let settings = await CafeSetting.findOne({ branch: branchId });
    if (!settings) {
      // auto-create default settings for branch
      const branch = await Branch.findById(branchId);
      settings = await CafeSetting.create({
        branch: branchId,
        cafeName: branch?.name || 'Perfect Pizza',
        address: branch?.address || '',
        phone: branch?.phone || '',
        whatsapp: branch?.whatsapp || '',
        gstNumber: branch?.gstNumber || '09BCVPDD4203L2ZB',
        invoicePrefix: branch?.invoicePrefix || 'PP-KLP-',
      });
    }

    res.json(settings);
  } catch (error) {
    console.error('getSettings:', error);
    res.status(500).json({ message: error.message });
  }
};

const updateSettings = async (req, res) => {
  try {
    const branchId = req.user.branch._id || req.user.branch;
    const data = req.body;

    let settings = await CafeSetting.findOneAndUpdate(
      { branch: branchId },
      { $set: data },
      { new: true, upsert: true }
    );

    // Keep Branch collection in sync for key fields
    await Branch.findByIdAndUpdate(branchId, {
      name: data.cafeName || undefined,
      address: data.address || undefined,
      phone: data.phone || undefined,
      whatsapp: data.whatsapp || undefined,
      gstNumber: data.gstNumber || undefined,
      invoicePrefix: data.invoicePrefix || undefined,
    });

    res.json({ message: 'Settings updated', settings });
  } catch (error) {
    console.error('updateSettings:', error);
    res.status(500).json({ message: error.message });
  }
};

// ---------- STAFF ----------
const getStaff = async (req, res) => {
  try {
    const branchId = req.user.branch._id || req.user.branch;
    const staff = await User.find({ branch: branchId })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const addStaff = async (req, res) => {
  try {
    const branchId = req.user.branch._id || req.user.branch;
    const { name, phone, email, password, role } = req.body;

    if (!name || !phone || !password || !role) {
      return res.status(400).json({ message: 'Name, phone, password and role are required' });
    }

    // Only super-admin can create admin/super-admin
    if (['admin', 'super-admin'].includes(role) && req.user.role !== 'super-admin') {
      return res.status(403).json({ message: 'Only Super Admin can create Admin users' });
    }

    const exists = await User.findOne({ phone });
    if (exists) {
      return res.status(400).json({ message: 'Phone already registered' });
    }

    const user = await User.create({
      name,
      phone,
      email: email || '',
      password,
      role,
      branch: branchId,
      isActive: true,
    });

    res.status(201).json({
      message: 'Staff created',
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error('addStaff:', error);
    res.status(500).json({ message: error.message });
  }
};

const updateStaff = async (req, res) => {
  try {
    const { name, email, role, isActive, password } = req.body;
    const staff = await User.findById(req.params.id);

    if (!staff) return res.status(404).json({ message: 'Staff not found' });

    // Protect super-admin from demotion by non super-admin
    if (staff.role === 'super-admin' && req.user.role !== 'super-admin') {
      return res.status(403).json({ message: 'Cannot edit Super Admin' });
    }

    if (name) staff.name = name;
    if (email !== undefined) staff.email = email;
    if (role && req.user.role === 'super-admin') staff.role = role;
    if (typeof isActive === 'boolean') staff.isActive = isActive;
    if (password && password.trim().length >= 4) staff.password = password; // pre-save hook hashes

    await staff.save();

    res.json({
      message: 'Staff updated',
      user: {
        _id: staff._id,
        name: staff.name,
        phone: staff.phone,
        email: staff.email,
        role: staff.role,
        isActive: staff.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteStaff = async (req, res) => {
  try {
    const staff = await User.findById(req.params.id);
    if (!staff) return res.status(404).json({ message: 'Staff not found' });

    if (staff.role === 'super-admin') {
      return res.status(403).json({ message: 'Cannot delete Super Admin' });
    }
    if (String(staff._id) === String(req.user._id)) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Staff deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getSettings,
  updateSettings,
  getStaff,
  addStaff,
  updateStaff,
  deleteStaff,
};