const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  // Accept token from Authorization header OR ?token= query param (for SSE EventSource)
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ')
    ? header.slice(7)
    : req.query.token || null;

  if (!token) return res.status(401).json({ error: 'Token required' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function adminOnly(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ')
    ? header.slice(7)
    : req.query.token || null;

  if (!token) return res.status(401).json({ error: 'Token required' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { auth, adminOnly };
