const { z } = require('./common');

const messagesQuery = z.object({
  // Cursor: return messages created before this timestamp.
  before: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

const sendMessage = z.object({
  text: z.string().trim().min(1, 'Message cannot be empty').max(2000),
});

module.exports = { messagesQuery, sendMessage };
