const mongoose = require('mongoose');

const fitnessClassSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Class title is required'],
      trim: true,
    },
    trainerName: {
      type: String,
      required: [true, 'Trainer name is required'],
      trim: true,
    },
    scheduleDate: {
      type: Date,
      required: [true, 'Schedule date is required'],
    },
    durationMinutes: {
      type: Number,
      default: 60,
      min: [1, 'Duration must be at least 1 minute'],
    },
    maxCapacity: {
      type: Number,
      required: [true, 'Max capacity is required'],
      min: [1, 'Max capacity must be at least 1'],
    },
    enrolledMembers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

/**
 * Virtual: how many seats remain. Handy for clients and tests.
 */
fitnessClassSchema.virtual('availableSlots').get(function availableSlots() {
  return Math.max(0, this.maxCapacity - this.enrolledMembers.length);
});

/**
 * Virtual: whether the class is full.
 */
fitnessClassSchema.virtual('isFull').get(function isFull() {
  return this.enrolledMembers.length >= this.maxCapacity;
});

fitnessClassSchema.set('toJSON', { virtuals: true });
fitnessClassSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('FitnessClass', fitnessClassSchema);
