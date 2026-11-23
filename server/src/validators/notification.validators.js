const { z, objectId, pageQuery } = require('./common');

const list = z.object({
  // ?unread=true → only unread
  unread: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  ...pageQuery,
});

const idParams = z.object({ id: objectId });

module.exports = { list, idParams };
