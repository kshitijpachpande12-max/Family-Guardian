// ============================================
// Family Guardian - Express Server Entry Point
// ============================================
// This is the main file that starts our Express server.
// Think of it as the "front door" of our API.
// ============================================

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// --- Middleware ---
// Middleware = functions that run on EVERY request before your route handler.
// Think of them as security guards at the door checking everyone who enters.

// cors() lets our React frontend (on port 5173) talk to our API (on port 5000).
// Without this, the browser blocks cross-origin requests for security.
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
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

// --- Routes ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/payments', require('./routes/payments'));

// --- Connect to MongoDB and Start Server ---
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`🛡️  Family Guardian API running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    // Start server anyway so health check works during development
    app.listen(PORT, () => {
      console.log(`⚠️  Server running on port ${PORT} (no database)`);
    });
  });

module.exports = app; // Export for testing
