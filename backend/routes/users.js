const router = require('express').Router();
const bcrypt = require('bcryptjs');
const User   = require('../models/User');
const { auth, adminOnly } = require('../middleware/auth');

// GET /api/users
router.get('/', auth, async (req, res) => {
  try {
    const users = await User.find({}, '-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/users
router.post('/', adminOnly, async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Fields required' });
    if (await User.findOne({ username: username.toLowerCase() }))
      return res.status(409).json({ error: 'User exists' });
    const hash = await bcrypt.hash(password, 12);
    const user = await User.create({ username: username.toLowerCase(), password: hash, role: role || 'auditor' });
    res.status(201).json({ message: 'User created', user: { username: user.username, role: user.role } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/users/:id
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
