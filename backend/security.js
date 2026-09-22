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
  return jwt.sign({ userId: user.id, role: normalizeRole(user.role), email: user.email, tokenVersion: Number(user.token_version) || 0 }, jwtSecret, { expiresIn: '15m' });
}

function issueRefreshToken(user) {
  return jwt.sign({ userId: user.id, tokenVersion: Number(user.token_version) || 0, type: 'refresh' }, jwtSecret, { expiresIn: '7d' });
}

function authGuard(allowedRoles = []) {
  return async (request, response, next) => {
    const header = request.headers.authorization || '';
    const isDashboardStream = request.path.endsWith('/dashboard/stream') || request.path === '/stream';
    const token = header.startsWith('Bearer ') ? header.slice(7) : (isDashboardStream ? String(request.query.token || '') : '');
    if (!token) return response.status(401).json({ error: 'Authentication required.' });
    try {
      request.user = jwt.verify(token, jwtSecret);
      const currentUser = request.app.locals.resolveAuthUser ? await request.app.locals.resolveAuthUser(request.user.userId) : null;
      if (!currentUser || currentUser.is_active === false || currentUser.status !== 'ACTIVE' || Number(currentUser.token_version || 0) !== Number(request.user.tokenVersion || 0)) {
        return response.status(401).json({ error: 'Session revoked. Please sign in again.' });
      }
      request.user.role = normalizeRole(request.user.role);
      if (allowedRoles.length && !isRoleAllowed(request.user.role, allowedRoles)) {
        return response.status(403).json({ error: 'Insufficient permissions.' });
      }
      next();
    } catch (_error) { return response.status(401).json({ error: 'Invalid or expired token.' }); }
  };
}

module.exports = { hashPassword, verifyPassword, issueToken, issueRefreshToken, authGuard, normalizeRole, isRoleAllowed, verifyToken: (token) => jwt.verify(token, jwtSecret) };
