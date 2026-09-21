require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const accounts = [
  ['management.test@safisquad.local', 'MANAGEMENT'],
  ['secretariat.test@safisquad.local', 'SECRETARIAT'],
  ['finance.test@safisquad.local', 'FINANCE'],
  ['promotions.test@safisquad.local', 'PROMOTIONS'],
  ['technical.test@safisquad.local', 'TECHNICAL'],
];
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const passwordHash = await bcrypt.hash('SafiTest!2026', 12);
  for (const [email, role] of accounts) {
    await pool.query(
      'INSERT INTO users (email, password_hash, role, name) VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO UPDATE SET password_hash = $2, role = $3, name = $4',
      [email, passwordHash, role, `Safi ${role} Test`],
    );
  }
  console.log('Local test dashboard accounts ready.');
})().finally(() => pool.end());
