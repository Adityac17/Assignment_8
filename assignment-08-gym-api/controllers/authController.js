const bcrypt = require('bcryptjs');
const passport = require('passport');
const User = require('../models/User');

const VALID_TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum'];

/**
 * POST /api/auth/register
 * body: { username, email, password, membershipTier?, durationMonths? }
 */
async function register(req, res, next) {
  try {
    const { username, email, password, membershipTier, durationMonths } = req.body || {};

    // --- validation -------------------------------------------------------
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'username, email and password are required',
      });
    }

    if (membershipTier && !VALID_TIERS.includes(membershipTier)) {
      return res.status(400).json({
        success: false,
        message: `membershipTier must be one of: ${VALID_TIERS.join(', ')}`,
      });
    }

    const months = durationMonths == null ? 1 : Number(durationMonths);
    if (Number.isNaN(months) || months <= 0) {
      return res.status(400).json({
        success: false,
        message: 'durationMonths must be a positive number',
      });
    }

    // --- duplicate check --------------------------------------------------
    const existing = await User.findOne({
      $or: [{ username: username.trim() }, { email: String(email).toLowerCase().trim() }],
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A user with that username or email already exists',
      });
    }

    // --- create -----------------------------------------------------------
    const hashed = await bcrypt.hash(password, 10);
    const user = new User({
      username: username.trim(),
      email,
      password: hashed,
      membershipTier: membershipTier || 'Bronze',
    });
    // Stage the month count; the User pre-save hook computes expiry = months*30 days.
    user.durationMonths = months;
    await user.save();

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: user.toJSON(),
    });
  } catch (err) {
    // Handle Mongo duplicate-key race + validation errors as 400.
    if (err && (err.code === 11000 || err.name === 'ValidationError')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return next(err);
  }
}

/**
 * POST /api/auth/login
 * Uses passport local strategy; establishes a session on success.
 */
function login(req, res, next) {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: (info && info.message) || 'Invalid credentials',
      });
    }
    req.logIn(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: user.toJSON(),
      });
    });
  })(req, res, next);
}

/**
 * POST /api/auth/logout
 * Destroys the session. (Convenience endpoint.)
 */
function logout(req, res, next) {
  req.logout((err) => {
    if (err) return next(err);
    return res.status(200).json({ success: true, message: 'Logged out' });
  });
}

/**
 * GET /api/auth/me
 * Authenticated only. Returns the profile plus computed remainingDays, and keeps
 * membershipStatus in sync (flips to 'expired' if past due).
 */
async function me(req, res, next) {
  try {
    const user = req.user;

    // Keep status in sync with the clock.
    const isPastDue =
      !user.membershipExpiryDate || user.membershipExpiryDate.getTime() < Date.now();
    if (isPastDue && user.membershipStatus !== 'expired' && user.membershipStatus !== 'frozen') {
      user.membershipStatus = 'expired';
      await user.save();
    }

    const data = user.toJSON();
    // remainingDays virtual is already included via toJSON; ensure explicit field.
    data.remainingDays = user.remainingDays;

    return res.status(200).json({
      success: true,
      message: 'Current user profile',
      data,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { register, login, logout, me };
