const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const NOTIFICATION_TYPES = [
  'request:new',
  'request:accepted',
  'request:declined',
  'session:proposed',
  'session:accepted',
  'session:declined',
  'session:cancelled',
  'session:confirmed',
  'session:completed',
  'session:auto-completed',
  'session:expired',
  'review:new',
];

/** Something that happened that a user should know about, with a link to where it happened. */
const notificationSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true }, // recipient
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    actor: { type: ObjectId, ref: 'User', default: null }, // null = SkillSwap itself (the sweeper)
    // Small facts for the message, e.g. { skill: 'Guitar', credits: 1, rating: 5 }.
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    link: { type: String, required: true }, // client route, e.g. /sessions
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false },
);

// My notifications, newest first.
notificationSchema.index({ user: 1, createdAt: -1 });
// "How many unread?": a partial index that only contains unread notifications, so it stays small.
notificationSchema.index(
  { user: 1 },
  { partialFilterExpression: { readAt: null }, name: 'unread_by_user' },
);
// MongoDB deletes notifications 90 days after they're created.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

const Notification = mongoose.model('Notification', notificationSchema);
Notification.TYPES = NOTIFICATION_TYPES;

module.exports = Notification;
