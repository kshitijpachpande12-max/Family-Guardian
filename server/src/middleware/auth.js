// ================================================
// Auth Middleware - JWT Verification & Role Guards
// ================================================
// Middleware = a function that runs BEFORE your route handler.
// It checks: "Is this request allowed?" If not, it sends a
// 401 (Unauthorized) or 403 (Forbidden) and stops.
//
// JWT (JSON Web Token) = a signed string the server gives you
// at login. You send it with every request to prove who you are.
// The server verifies the signature — no database lookup needed.
// ================================================

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware: Verify JWT and attach user to req.user
 * 
 * How it works:
 * 1. Client sends header: "Authorization: Bearer <token>"
 * 2. We extract the token, verify the signature with our JWT_SECRET
 * 3. If valid, we fetch the user from DB and attach to req.user
 * 4. If invalid/missing, we return 401
 */
const authenticate = async (req, res, next) => {
  try {
    // Extract token from "Bearer <token>" header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided. Please log in.' });
    }

    const token = authHeader.split(' ')[1];

    // Verify token signature and decode the payload
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user from DB (without password)
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found. Token may be invalid.' });
    }

    // Attach user to the request object — all downstream handlers can use req.user
    req.user = user;
    next();  // Continue to the next middleware/route handler
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

/**
 * Middleware factory: Restrict access to specific roles
 * 
 * Usage: authorize('guardian') or authorize('senior', 'guardian')
 * Must be used AFTER authenticate middleware.
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}.`
      });
    }

    next();
  };
};

module.exports = { authenticate, authorize };
