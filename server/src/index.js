// ============================================
// Family Guardian - Express Server Entry Point
// ============================================
// This is the main file that starts our Express server.
// Think of it as the "front door" of our API.
// ============================================

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '8.8.4.4']); } catch (e) {}
require('dotenv').config();

const app = express();

// --- Middleware ---
// Middleware = functions that run on EVERY request before your route handler.
// Think of them as security guards at the door checking everyone who enters.

// cors() lets our React frontend (on port 5173) talk to our API (on port 5000).
// Without this, the browser blocks cross-origin requests for security.
// cors() configuration that allows localhost on any port in development
app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== 'production' || origin === process.env.CLIENT_URL) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));

// express.json() parses incoming JSON request bodies so we can access req.body.
// Without this, req.body would be undefined.
app.use(express.json());

// --- Health Check Route ---
// A simple route to verify the server is running.
// Useful for Render health checks and quick debugging.
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Family Guardian API',
    timestamp: new Date().toISOString()
  });
});

// Connect to MongoDB on demand (serverless-friendly)
app.use(async (req, res, next) => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
  next();
});

// --- Routes ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/payments', require('./routes/payments'));

// --- Connect to MongoDB and Start Server ---
const PORT = process.env.PORT || 5000;
if (require.main === module) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
      console.log('✅ Connected to MongoDB');
      app.listen(PORT, () => console.log(`🛡️ Family Guardian API running on port ${PORT}`));
    })
    .catch(err => console.error('❌ MongoDB connection error:', err.message));
}
module.exports = app;
