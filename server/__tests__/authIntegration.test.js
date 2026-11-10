// ================================================
// Auth & User Registration Integration Test
// ================================================

require('dotenv').config();
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '8.8.4.4']); } catch(e){}

const mongoose = require('mongoose');
const User = require('../src/models/User');

describe('Auth Model & Hashing Unit Test', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    }
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['test_senior@test.com', 'test_guardian@test.com'] } });
    await mongoose.disconnect();
  });

  test('Successfully creates senior and hashes password without next() error', async () => {
    await User.deleteOne({ email: 'test_senior@test.com' });

    const senior = await User.create({
      name: 'Test Senior',
      email: 'test_senior@test.com',
      password: 'password123',
      role: 'senior'
    });

    expect(senior).toBeDefined();
    expect(senior._id).toBeDefined();
    expect(senior.password).not.toBe('password123'); // Password was hashed!

    // Test password comparison
    const userWithPw = await User.findOne({ email: 'test_senior@test.com' }).select('+password');
    const isMatch = await userWithPw.comparePassword('password123');
    expect(isMatch).toBe(true);

    const isBadMatch = await userWithPw.comparePassword('wrongpassword');
    expect(isBadMatch).toBe(false);
  });

  test('Successfully creates guardian linked to senior', async () => {
    await User.deleteOne({ email: 'test_guardian@test.com' });
    const senior = await User.findOne({ email: 'test_senior@test.com' });

    const guardian = await User.create({
      name: 'Test Guardian',
      email: 'test_guardian@test.com',
      password: 'password123',
      role: 'guardian',
      linkedSenior: senior._id
    });

    expect(guardian).toBeDefined();
    expect(guardian.linkedSenior.toString()).toBe(senior._id.toString());
  });
});
