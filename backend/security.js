const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const jwtSecret = process.env.JWT_SECRET || 'replace-this-development-secret';

const ROLE_ALIASES = {
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
  MANAGEMENT: 'MANAGEMENT',
  SECRETARIAT: 'SECRETARIAT',
  PROMOTIONS: 'PROMOTIONS',
  TECHNICAL: 'TECHNICAL',
  FINANCE: 'FINANCE',
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
  if (normalizedAllowed.includes(normalizedRole)) return true;
  if (normalizedAllowed.includes('ADMIN') && ['SUPER_ADMIN', 'MANAGEMENT'].includes(normalizedRole)) return true;
  if (normalizedAllowed.includes('MEMBER') && ['SECRETARIAT', 'PROMOTIONS', 'TECHNICAL'].includes(normalizedRole)) return true;
  if (normalizedAllowed.includes('FINANCE_OFFICER') && normalizedRole === 'FINANCE') return true;
  return false;
}

function issueToken(user) {
  return jwt.sign({ userId: user.id, role: normalizeRole(user.role), email: user.email }, jwtSecret, { expiresIn: '8h' });
}

function authGuard(allowedRoles = []) {
  return (request, response, next) => {
    const header = request.headers.authorization || '';
    const isDashboardStream = request.path.endsWith('/dashboard/stream') || request.path === '/stream';
    const token = header.startsWith('Bearer ') ? header.slice(7) : (isDashboardStream ? String(request.query.token || '') : '');
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
