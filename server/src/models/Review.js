const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

/** A rating one participant gives the other after a completed session. */
const reviewSchema = new mongoose.Schema(
  {
    session: { type: ObjectId, ref: 'Session', required: true },
    reviewer: { type: ObjectId, ref: 'User', required: true },
    reviewee: { type: ObjectId, ref: 'User', required: true },
    // The reviewee's role in that session, e.g. "taught Guitar" vs "learned Guitar".
    role: { type: String, enum: ['teacher', 'learner'], required: true },
    skill: { name: { type: String, required: true } },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true },
);

// One review per person per session, enforced by the database (not just a check in code).
reviewSchema.index({ session: 1, reviewer: 1 }, { unique: true });
reviewSchema.index({ reviewee: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
