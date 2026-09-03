const mongoose = require('mongoose');

const DAYS_PER_MONTH = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
    },
    membershipTier: {
      type: String,
      enum: ['Bronze', 'Silver', 'Gold', 'Platinum'],
      default: 'Bronze',
    },
    membershipStatus: {
      type: String,
      enum: ['active', 'expired', 'frozen'],
      default: 'active',
    },
    membershipExpiryDate: {
      type: Date,
      required: [true, 'Membership expiry date is required'],
    },
    emergencyContact: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

/**
 * Virtual setter: set `durationMonths` on a user document to have the
 * membershipExpiryDate computed by real Mongoose middleware (see pre-save hook).
 *
 * Assigning `user.durationMonths = 1` stages a request; the pre('save') hook
 * turns it into an expiry that is EXACTLY durationMonths * 30 days from "now".
 */
userSchema
  .virtual('durationMonths')
  .set(function setDurationMonths(months) {
    this._durationMonths = months;
  })
  .get(function getDurationMonths() {
    return this._durationMonths;
  });

/**
 * Helper (also exported statically) to compute an expiry date that is exactly
 * `months * 30` days after the supplied baseline date.
 */
function computeExpiry(months, from = new Date()) {
  const n = Number(months);
  const base = from instanceof Date ? from : new Date(from);
  return new Date(base.getTime() + n * DAYS_PER_MONTH * MS_PER_DAY);
}

/**
 * pre-save middleware.
 * If a `durationMonths` value has been staged (via the virtual) and no explicit
 * membershipExpiryDate was set, compute the expiry as EXACTLY durationMonths*30
 * days from now. This is real Mongoose middleware — controllers only stage the
 * month count, the model owns the date math.
 */
userSchema.pre('save', function preSave(next) {
  if (this._durationMonths != null && this.isNew && !this.membershipExpiryDate) {
    this.membershipExpiryDate = computeExpiry(this._durationMonths);
  }
  // Keep membershipStatus in sync with the expiry date on every save, unless the
  // membership has been deliberately frozen.
  if (this.membershipStatus !== 'frozen' && this.membershipExpiryDate) {
    this.membershipStatus =
      this.membershipExpiryDate.getTime() < Date.now() ? 'expired' : 'active';
  }
  next();
});

/**
 * Instance method to renew a membership. Extends membershipExpiryDate by
 * additionalMonths*30 days from whichever is later: now, or the current expiry
 * (so an active membership is never shortened). Optionally updates the tier and
 * always flips the status back to active. Caller must save().
 */
userSchema.methods.renew = function renew(additionalMonths, tier) {
  const now = new Date();
  const current = this.membershipExpiryDate || now;
  const baseline = current.getTime() > now.getTime() ? current : now;
  this.membershipExpiryDate = computeExpiry(additionalMonths, baseline);
  if (tier) {
    this.membershipTier = tier;
  }
  this.membershipStatus = 'active';
  return this;
};

/**
 * Virtual: remaining days until expiry, floored at 0 (never negative).
 */
userSchema.virtual('remainingDays').get(function remainingDays() {
  if (!this.membershipExpiryDate) return 0;
  const diffMs = this.membershipExpiryDate.getTime() - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / MS_PER_DAY);
});

// Strip password whenever a user is serialized to JSON.
userSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    delete ret.password;
    delete ret._durationMonths;
    return ret;
  },
});
userSchema.set('toObject', { virtuals: true });

// Expose the pure date helper for unit tests / reuse.
userSchema.statics.computeExpiry = computeExpiry;

const User = mongoose.model('User', userSchema);

module.exports = User;
module.exports.computeExpiry = computeExpiry;
module.exports.DAYS_PER_MONTH = DAYS_PER_MONTH;
