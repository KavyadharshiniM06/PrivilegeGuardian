const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const { auth } = require('../middleware/auth');

router.post('/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    if (await User.findOne({ username })) return res.status(409).json({ error: 'Username already exists' });
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hash, role: role || 'auditor' });
    res.status(201).json({ message: 'Registered', user: { username: user.username, role: user.role } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Fields required' });
    const user = await User.findOne({ username });
    if (!user || !await bcrypt.compare(password, user.password))
      return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({ token, user: { username: user.username, role: user.role } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/me', auth, (req, res) => res.json(req.user));

module.exports = router;
