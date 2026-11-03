// ================================================
// User Model - Mongoose Schema
// ================================================
// Two roles: "senior" (the elderly person making payments)
// and "guardian" (the family member who approves/blocks).
//
// A guardian has a "linkedSenior" field pointing to the
// senior they protect. This is a foreign key relationship
// (like a JOIN in SQL, but in MongoDB we use "ref").
// ================================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false  // Don't include password in queries by default (security)
  },
  role: {
    type: String,
    enum: ['senior', 'guardian'],
    required: [true, 'Role is required']
  },
  // Only for guardians: which senior are they linked to?
  linkedSenior: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true  // Automatically adds createdAt and updatedAt
});

// --- Pre-save Hook: Hash password before storing ---
// "Pre-save" means this runs BEFORE mongoose saves the document.
// bcrypt turns "password123" into "$2a$10$X7..." (irreversible hash).
// Even if someone steals the database, they can't read passwords.
userSchema.pre('save', async function (next) {
  // Only hash if the password field was modified (not on every save)
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);   // 10 rounds of salting
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// --- Instance method: compare a plaintext password to the hash ---
// We call this during login: user.comparePassword(req.body.password)
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
