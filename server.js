require('dotenv').config();
const express = require('express');
const path = require('path');
const pool = require('./db');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/calculations', async (req, res) => {
  const { calculation, answer } = req.body;

  if (typeof calculation !== 'string' || !calculation.trim() || typeof answer !== 'number' || !Number.isFinite(answer)) {
    return res.status(400).json({ error: 'calculation (string) and answer (finite number) are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO calculations (calculation, answer) VALUES ($1, $2) RETURNING id',
      [calculation, answer]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save calculation' });
  }
});

app.listen(port, () => {
  console.log(`Calculator app running at http://localhost:${port}`);
});
