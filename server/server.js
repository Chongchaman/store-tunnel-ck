// ============================================================
// server.js — STORE TUNNEL CK Node.js API
// ============================================================
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const apiRoute = require('./routes/api');

const app  = express();
const PORT = process.env.PORT || 8080;

// ── CORS: อนุญาต GitHub Pages + localhost ──
const allowedOrigins = [
  'https://chongchaman.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '2mb' }));

// ── Health check ──
app.get('/', (_req, res) => res.send('STORE TUNNEL CK API is running. ✅'));

// ── Main API endpoint ──
app.post('/api', apiRoute);

app.listen(PORT, () => {
  console.log(`[STORE TUNNEL CK] Server running on port ${PORT}`);
});
