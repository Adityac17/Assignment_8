/**
 * Guard that allows the request through only when a session-authenticated user
 * exists. Responds 401 with the standard JSON envelope otherwise.
 */
function isAuthenticated(req, res, next) {
  if (typeof req.isAuthenticated === 'function' && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({
    success: false,
    message: 'Not authenticated. Please log in first.',
  });
}

module.exports = isAuthenticated;
