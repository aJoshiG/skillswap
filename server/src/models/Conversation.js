const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      validate: [(v) => v.length === 2, 'A conversation has exactly two participants'],
    },
    // One conversation per pair of users: both user ids, sorted and joined. Accepting a later
    // swap between the same two people reuses this thread instead of opening a duplicate.
    pairKey: { type: String, required: true, unique: true },
    // The most recently accepted swap between the pair (shown in the chat header).
    request: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SwapRequest',
      required: true,
    },
    lastMessage: {
      text: { type: String, default: '' },
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      createdAt: { type: Date, default: null },
    },
  },
  { timestamps: true },
);

conversationSchema.index({ participants: 1, updatedAt: -1 });

const pairKeyFor = (a, b) => [String(a), String(b)].sort().join(':');

conversationSchema.pre('validate', function setPairKey() {
  if (this.participants?.length === 2) this.pairKey = pairKeyFor(...this.participants);
});

const Conversation = mongoose.model('Conversation', conversationSchema);
Conversation.pairKeyFor = pairKeyFor;

module.exports = Conversation;
