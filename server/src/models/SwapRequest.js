const mongoose = require('mongoose');
const { REQUEST_STATUS, SKILL_LEVELS, SKILL_CATEGORIES } = require('../config/constants');

// A snapshot of the skill at the time of the request, so later profile edits don't change history.
const skillSnapshot = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, enum: SKILL_CATEGORIES },
    level: { type: String, enum: SKILL_LEVELS },
  },
  { _id: false },
);

const swapRequestSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // The skill the recipient offers, which the sender wants to learn.
    skill: { type: skillSnapshot, required: true },
    // Optional skill the sender offers to teach in return.
    offeredSkill: { type: skillSnapshot, default: null },
    message: { type: String, trim: true, maxlength: 500, default: '' },
    status: { type: String, enum: REQUEST_STATUS, default: 'pending' },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

swapRequestSchema.index({ from: 1, status: 1, createdAt: -1 });
swapRequestSchema.index({ to: 1, status: 1, createdAt: -1 });
// Database-level guarantee: only one pending request per sender, recipient and skill.
swapRequestSchema.index(
  { from: 1, to: 1, 'skill.name': 1 },
  { unique: true, partialFilterExpression: { status: 'pending' }, name: 'one_pending_per_skill' },
);

module.exports = mongoose.model('SwapRequest', swapRequestSchema);
