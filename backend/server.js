require('dotenv').config();

const cors = require('cors');
const express = require('express');
const pool = require('./db');

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', async (_request, response) => {
  try {
    await pool.query('SELECT 1');
    response.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('Database health check failed', error.message);
    response.status(503).json({ status: 'degraded', database: 'disconnected' });
  }
});

app.get('/api/summary', (_request, response) => {
  response.json({
    activeProjects: 24,
    teamMembers: 18,
    tasksCompleted: 86,
    completionRate: 72,
  });
});

app.get('/api/site-content', (_request, response) => {
  response.json({
    cities: 6,
    stores: 185,
    garments: '350K',
    services: ['Dry cleaning', 'Laundry', 'Steam ironing', 'Shoe care'],
    sigma: ['Unique barcode tags', 'Specialised segregation', 'Wash care instructions', 'Fabric-friendly detergents', 'Steam press', 'Three-stage quality check'],
  });
});

app.post('/api/pickups', (request, response) => {
  const { name, phone, service, area } = request.body;
  if (!name || !phone || !service || !area) {
    return response.status(400).json({ error: 'Name, phone, service, and pickup area are required.' });
  }
  response.status(201).json({ message: 'Pickup request received', request: { name, phone, service, area } });
});

app.listen(port, () => {
  console.log(`V Legendary API running on http://localhost:${port}`);
});
