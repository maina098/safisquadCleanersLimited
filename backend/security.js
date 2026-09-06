const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const jwtSecret = process.env.JWT_SECRET || 'replace-this-development-secret';

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

function issueToken(user) {
  return jwt.sign({ userId: user.id, role: user.role, email: user.email }, jwtSecret, { expiresIn: '8h' });
}

function authGuard(allowedRoles = []) {
  return (request, response, next) => {
    const header = request.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return response.status(401).json({ error: 'Authentication required.' });
    try {
      request.user = jwt.verify(token, jwtSecret);
      if (allowedRoles.length && !allowedRoles.includes(request.user.role)) return response.status(403).json({ error: 'Insufficient permissions.' });
      next();
    } catch (_error) { return response.status(401).json({ error: 'Invalid or expired token.' }); }
  };
}

module.exports = { hashPassword, verifyPassword, issueToken, authGuard };
