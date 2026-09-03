/**
 * Guard for actions that require an active membership (e.g. booking a class).
 *
 * Must run AFTER authMiddleware, so req.user is present. Blocks the request with
 * 400 "Membership expired" when the member's status is 'expired'/'frozen' or the
 * membershipExpiryDate is in the past. Also keeps membershipStatus in sync by
 * flipping a past-due user to 'expired' and persisting it.
 */
async function checkActiveMember(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated. Please log in first.',
      });
    }

    const isPastDue =
      !user.membershipExpiryDate ||
      user.membershipExpiryDate.getTime() < Date.now();

    if (isPastDue && user.membershipStatus !== 'expired') {
      user.membershipStatus = 'expired';
      // Persist the corrected status; ignore save errors for the guard decision.
      try {
        await user.save();
      } catch (_) {
        /* non-fatal: still block below */
      }
    }

    if (user.membershipStatus !== 'active' || isPastDue) {
      return res.status(400).json({
        success: false,
        message: 'Membership expired',
      });
    }

    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = checkActiveMember;
