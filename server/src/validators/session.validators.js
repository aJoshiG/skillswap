const { z, objectId, pageQuery } = require('./common');
const { SESSION_DURATIONS } = require('../config/constants');

const create = z.object({
  requestId: objectId,
  // Which side of the swap this session teaches: the skill that was asked for, or the one offered.
  skill: z.enum(['requested', 'offered']),
  scheduledAt: z.coerce.date().refine((d) => d.getTime() > Date.now(), 'Pick a time in the future'),
  durationMinutes: z.coerce
    .number()
    .refine(
      (n) => SESSION_DURATIONS.includes(n),
      `Duration must be one of ${SESSION_DURATIONS.join(', ')} minutes`,
    ),
  mode: z.enum(['online', 'in-person']),
  note: z.string().trim().max(300).default(''),
});

const list = z.object({
  scope: z.enum(['active', 'history']).default('active'),
  ...pageQuery,
});

const respondParams = z.object({
  id: objectId,
  action: z.enum(['accept', 'decline', 'cancel', 'confirm']),
});

const creditsQuery = z.object({ ...pageQuery });

module.exports = { create, list, respondParams, creditsQuery };
