const express = require('express');
const {
  listClasses,
  getClass,
  createClass,
  bookClass,
  cancelBooking,
} = require('../controllers/classController');
const isAuthenticated = require('../middleware/authMiddleware');
const checkActiveMember = require('../middleware/checkActiveMember');

const router = express.Router();

// Public reads.
router.get('/', listClasses);
router.get('/:id', getClass);

// Create a class. (Left open for this assignment; see README design notes.)
router.post('/', createClass);

// Booking requires an authenticated user with an ACTIVE membership.
router.post('/:id/book', isAuthenticated, checkActiveMember, bookClass);

// Cancelling requires only authentication.
router.delete('/:id/cancel', isAuthenticated, cancelBooking);

module.exports = router;
