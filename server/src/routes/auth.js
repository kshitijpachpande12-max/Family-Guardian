// ================================================
// Auth Routes - Register & Login
// ================================================
// POST /api/auth/register - Create a new user (senior or guardian)
// POST /api/auth/login    - Get a JWT token
// GET  /api/auth/me       - Get current user info (protected)
// ================================================

const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * Generate a JWT for a user.
 * The token contains: { userId, role }
 * It expires in 7 days (fine for a hackathon; production would be shorter).
 */
function generateToken(user) {
  return jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// ---- POST /api/auth/register ----
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, linkedSeniorEmail } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Validate role
    if (!['senior', 'guardian'].includes(role)) {
      return res.status(400).json({ error: 'Role must be "senior" or "guardian".' });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    // If registering as guardian, link to a senior
    let linkedSenior = null;
    if (role === 'guardian') {
      if (!linkedSeniorEmail) {
        return res.status(400).json({
          error: 'Guardians must provide the email of the senior they are protecting.'
        });
      }

      const normalizedSeniorEmail = linkedSeniorEmail.trim().toLowerCase();
      const senior = await User.findOne({ email: normalizedSeniorEmail, role: 'senior' });
      if (!senior) {
        return res.status(404).json({
          error: `No senior found with email "${linkedSeniorEmail}". The senior must register first.`
        });
      }
      linkedSenior = senior._id;
    }

    // Create user (password is hashed by the pre-save hook in User model)
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role,
      linkedSenior
    });

    // Generate token and respond
    const token = generateToken(user);

    res.status(201).json({
      message: 'Registration successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        linkedSenior: user.linkedSenior
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: err.message || 'Server error during registration.' });
  }
});

// ---- POST /api/auth/login ----
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find user and explicitly include the password field (it's excluded by default)
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Compare plaintext password with the stored hash
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken(user);

    res.json({
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        linkedSenior: user.linkedSenior
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message || 'Server error during login.' });
  }
});

// ---- GET /api/auth/me ----
// Protected route: returns the logged-in user's profile
router.get('/me', authenticate, async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      linkedSenior: req.user.linkedSenior
    }
  });
});

module.exports = router;
