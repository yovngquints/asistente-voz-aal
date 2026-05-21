const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'aal_voz_secret';

function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
  try {
    req.user = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Sesión expirada' });
  }
}

module.exports = { verifyToken, JWT_SECRET };
