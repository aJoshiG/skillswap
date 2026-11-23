const mongoose = require('mongoose');
const { CREDIT_TYPES } = require('../config/constants');

/**
 * Append-only ledger of credit movements. Written in the same MongoDB transaction as the
 * balance change on User.credits, so sum(amount) per user always equals their balance.
 */
const creditTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true }, // + earned/refunded, - held
    balanceAfter: { type: Number, required: true },
    type: { type: String, enum: CREDIT_TYPES, required: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

creditTransactionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('CreditTransaction', creditTransactionSchema);
