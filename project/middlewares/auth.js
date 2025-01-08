const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  // Get token from Authorization header, splitting "Bearer <token>"
  const token = req.header('Authorization')?.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access denied, no token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Save decoded user information in request
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid token' });
  }
}

function roleMiddleware(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Access denied, insufficient permissions' });
    }
    next();
  };
}

module.exports = { authMiddleware, roleMiddleware };

