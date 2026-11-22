const { z, objectId, pageQuery } = require('./common');
const { REQUEST_STATUS } = require('../config/constants');

const create = z.object({
  to: objectId,
  // _id of a skill in the recipient's skillsOffered.
  skillId: objectId,
  // Optional _id of a skill in the sender's own skillsOffered, offered in return.
  offeredSkillId: objectId.optional(),
  message: z.string().trim().max(500).default(''),
});

const list = z.object({
  box: z.enum(['sent', 'received']).default('received'),
  status: z.enum(REQUEST_STATUS).optional(),
  ...pageQuery,
});

const respondParams = z.object({
  id: objectId,
  action: z.enum(['accept', 'decline', 'cancel']),
});

module.exports = { create, list, respondParams };
