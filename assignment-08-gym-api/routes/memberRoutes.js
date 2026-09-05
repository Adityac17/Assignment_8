const express = require('express');
const { renewMembership, listExpiredMembers } = require('../controllers/memberController');
const isAuthenticated = require('../middleware/authMiddleware');

const router = express.Router();

// List expired members. Requires authentication (admin-style read).
router.get('/expired', isAuthenticated, listExpiredMembers);

// Renew a member's membership. Requires authentication.
router.patch('/:id/renew', isAuthenticated, renewMembership);

module.exports = router;
