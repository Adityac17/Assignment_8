const mongoose = require('mongoose');
const FitnessClass = require('../models/FitnessClass');

/**
 * GET /api/classes
 * Public. Returns UPCOMING classes (scheduleDate >= now). Supports ?trainer=Name
 * (case-insensitive exact match) filtering.
 */
async function listClasses(req, res, next) {
  try {
    const query = { scheduleDate: { $gte: new Date() } };
    if (req.query.trainer) {
      query.trainerName = { $regex: `^${escapeRegex(req.query.trainer)}$`, $options: 'i' };
    }
    const classes = await FitnessClass.find(query).sort({ scheduleDate: 1 });
    return res.status(200).json({
      success: true,
      message: 'Upcoming classes',
      data: classes,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/classes/:id
 * Public. Populates enrolledMembers with username/email only. 404 if not found.
 */
async function getClass(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }
    const fitnessClass = await FitnessClass.findById(req.params.id).populate(
      'enrolledMembers',
      'username email'
    );
    if (!fitnessClass) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }
    return res.status(200).json({
      success: true,
      message: 'Class details',
      data: fitnessClass,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/classes
 * Creates a class. 400 on invalid input (e.g. maxCapacity < 1).
 */
async function createClass(req, res, next) {
  try {
    const { title, trainerName, scheduleDate, durationMinutes, maxCapacity } = req.body || {};

    if (!title || !trainerName || !scheduleDate || maxCapacity == null) {
      return res.status(400).json({
        success: false,
        message: 'title, trainerName, scheduleDate and maxCapacity are required',
      });
    }
    if (Number(maxCapacity) < 1 || Number.isNaN(Number(maxCapacity))) {
      return res.status(400).json({
        success: false,
        message: 'maxCapacity must be at least 1',
      });
    }
    const parsedDate = new Date(scheduleDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ success: false, message: 'scheduleDate is invalid' });
    }

    const created = await FitnessClass.create({
      title,
      trainerName,
      scheduleDate: parsedDate,
      durationMinutes: durationMinutes == null ? undefined : Number(durationMinutes),
      maxCapacity: Number(maxCapacity),
    });

    return res.status(201).json({
      success: true,
      message: 'Class created',
      data: created,
    });
  } catch (err) {
    if (err && err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: err.message });
    }
    return next(err);
  }
}

/**
 * POST /api/classes/:id/book
 * Authenticated + active membership (enforced by route middleware). Blocks when
 * the class is full or the user is already enrolled; otherwise enrolls the user.
 */
async function bookClass(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }
    const fitnessClass = await FitnessClass.findById(req.params.id);
    if (!fitnessClass) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const userId = req.user._id;

    // Prevent double-booking.
    const already = fitnessClass.enrolledMembers.some((m) => m.equals(userId));
    if (already) {
      return res.status(400).json({
        success: false,
        message: 'You are already enrolled in this class',
      });
    }

    // Capacity check.
    if (fitnessClass.enrolledMembers.length >= fitnessClass.maxCapacity) {
      return res.status(400).json({
        success: false,
        message: 'Class capacity reached',
      });
    }

    fitnessClass.enrolledMembers.push(userId);
    await fitnessClass.save();

    return res.status(200).json({
      success: true,
      message: 'Class booked successfully',
      data: fitnessClass,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * DELETE /api/classes/:id/cancel
 * Authenticated. Removes the logged-in user from enrolledMembers. Idempotent:
 * returns 200 even if the user was not enrolled (documented design choice).
 */
async function cancelBooking(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }
    const fitnessClass = await FitnessClass.findById(req.params.id);
    if (!fitnessClass) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const userId = req.user._id;
    const before = fitnessClass.enrolledMembers.length;
    fitnessClass.enrolledMembers = fitnessClass.enrolledMembers.filter(
      (m) => !m.equals(userId)
    );
    const removed = before !== fitnessClass.enrolledMembers.length;
    await fitnessClass.save();

    return res.status(200).json({
      success: true,
      message: removed
        ? 'Booking cancelled'
        : 'You were not enrolled in this class (nothing to cancel)',
      data: fitnessClass,
    });
  } catch (err) {
    return next(err);
  }
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { listClasses, getClass, createClass, bookClass, cancelBooking };
