const mongoose = require('mongoose');
const User = require('../models/User');

const VALID_TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum'];

/**
 * PATCH /api/members/:id/renew
 * body: { additionalMonths, tier? }
 * Extends membershipExpiryDate by additionalMonths*30 days from whichever is
 * later (now or current expiry), optionally updates the tier, and reactivates
 * the membership. 404 if the member is not found.
 */
async function renewMembership(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const { additionalMonths, tier } = req.body || {};
    const months = Number(additionalMonths);
    if (Number.isNaN(months) || months <= 0) {
      return res.status(400).json({
        success: false,
        message: 'additionalMonths must be a positive number',
      });
    }
    if (tier && !VALID_TIERS.includes(tier)) {
      return res.status(400).json({
        success: false,
        message: `tier must be one of: ${VALID_TIERS.join(', ')}`,
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    // Uses the model instance method; date math lives in the model.
    user.renew(months, tier);
    await user.save();

    const data = user.toJSON();
    data.remainingDays = user.remainingDays;

    return res.status(200).json({
      success: true,
      message: 'Membership renewed',
      data,
    });
  } catch (err) {
    if (err && err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: err.message });
    }
    return next(err);
  }
}

/**
 * GET /api/members/expired
 * Returns all users whose membershipExpiryDate is in the past. Also syncs their
 * membershipStatus to 'expired' (leaving 'frozen' memberships untouched).
 */
async function listExpiredMembers(req, res, next) {
  try {
    const now = new Date();

    // Keep statuses in sync: mark past-due, non-frozen members as expired.
    await User.updateMany(
      { membershipExpiryDate: { $lt: now }, membershipStatus: { $ne: 'frozen' } },
      { $set: { membershipStatus: 'expired' } }
    );

    const expired = await User.find({ membershipExpiryDate: { $lt: now } }).sort({
      membershipExpiryDate: 1,
    });

    return res.status(200).json({
      success: true,
      message: 'Expired members',
      data: expired.map((u) => u.toJSON()),
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { renewMembership, listExpiredMembers };
