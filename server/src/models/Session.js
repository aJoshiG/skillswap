const mongoose = require('mongoose');
const {
  SKILL_CATEGORIES,
  SKILL_LEVELS,
  SESSION_DURATIONS,
  SESSION_STATUS,
} = require('../config/constants');

const { ObjectId } = mongoose.Schema.Types;

/**
 * One scheduled lesson within an accepted swap: `teacher` teaches `skill` to `learner`.
 * Lifecycle: proposed → scheduled (learner's credits held) → completed (teacher paid, once both
 * confirm). A proposal can be declined; a scheduled session can be cancelled before it starts
 * (credits refunded).
 */
const sessionSchema = new mongoose.Schema(
  {
    request: { type: ObjectId, ref: 'SwapRequest', required: true },
    teacher: { type: ObjectId, ref: 'User', required: true },
    learner: { type: ObjectId, ref: 'User', required: true },
    skill: {
      name: { type: String, required: true },
      category: { type: String, enum: SKILL_CATEGORIES, default: 'other' },
      level: { type: String, enum: SKILL_LEVELS, default: 'beginner' },
    },
    scheduledAt: { type: Date, required: true },
    durationMinutes: { type: Number, enum: SESSION_DURATIONS, required: true },
    credits: { type: Number, required: true, min: 0 }, // price: durationMinutes / 60
    mode: { type: String, enum: ['online', 'in-person'], required: true },
    note: { type: String, trim: true, maxlength: 300, default: '' },
    proposedBy: { type: ObjectId, ref: 'User', required: true },
    status: { type: String, enum: SESSION_STATUS, default: 'proposed' },
    // Who has confirmed the session took place; completion needs both teacher and learner.
    confirmedBy: { type: [{ type: ObjectId, ref: 'User' }], default: [] },
    respondedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledBy: { type: ObjectId, ref: 'User', default: null },
    // Set when the session sweeper (not a person) completed or expired it.
    autoResolved: { type: Boolean, default: false },
  },
  { timestamps: true },
);

sessionSchema.index({ teacher: 1, status: 1, scheduledAt: 1 });
sessionSchema.index({ learner: 1, status: 1, scheduledAt: 1 });

module.exports = mongoose.model('Session', sessionSchema);
