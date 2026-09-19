const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const jwtSecret = process.env.JWT_SECRET || 'replace-this-development-secret';

const ROLE_ALIASES = {
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'ADMIN',
  MANAGEMENT: 'ADMIN',
  SECRETARIAT: 'MEMBER',
  PROMOTIONS: 'MEMBER',
  TECHNICAL: 'MEMBER',
  FINANCE: 'FINANCE_OFFICER',
  FINANCE_OFFICER: 'FINANCE_OFFICER',
  MEMBER: 'MEMBER',
  CUSTOMER: 'CUSTOMER',
};

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

function normalizeRole(role) {
  const value = String(role || '').trim().toUpperCase();
  return ROLE_ALIASES[value] || value;
}

function isRoleAllowed(role, allowedRoles = []) {
  const normalizedRole = normalizeRole(role);
  const normalizedAllowed = allowedRoles.map((entry) => normalizeRole(entry));
  return normalizedAllowed.includes(normalizedRole);
}

function issueToken(user) {
  return jwt.sign({ userId: user.id, role: normalizeRole(user.role), email: user.email }, jwtSecret, { expiresIn: '8h' });
}

function authGuard(allowedRoles = []) {
  return (request, response, next) => {
    const header = request.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return response.status(401).json({ error: 'Authentication required.' });
    try {
      request.user = jwt.verify(token, jwtSecret);
      request.user.role = normalizeRole(request.user.role);
      if (allowedRoles.length && !isRoleAllowed(request.user.role, allowedRoles)) {
        return response.status(403).json({ error: 'Insufficient permissions.' });
      }
      next();
    } catch (_error) { return response.status(401).json({ error: 'Invalid or expired token.' }); }
  };
}

module.exports = { hashPassword, verifyPassword, issueToken, authGuard, normalizeRole, isRoleAllowed };
