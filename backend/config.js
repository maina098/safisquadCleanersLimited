const nodeEnvironment = process.env.NODE_ENV || 'development';

function requireValue(name, predicate, message) {
  const value = process.env[name];
  if (!value || !predicate(value)) throw new Error(`${name}: ${message}`);
  return value;
}

if (nodeEnvironment === 'production') {
  requireValue('JWT_SECRET', (value) => value.length >= 32, 'must be at least 32 characters in production');
  requireValue('FRONTEND_URL', (value) => /^https?:\/\//.test(value), 'must be an absolute URL in production');
  requireValue('DATABASE_URL', (value) => /^postgres(?:ql)?:\/\//.test(value), 'must be a PostgreSQL URL in production');
}

module.exports = {
  nodeEnvironment,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'replace-this-development-secret',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  port: Number(process.env.PORT) || 4000,
};