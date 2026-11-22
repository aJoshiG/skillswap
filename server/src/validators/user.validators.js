const { z, pageQuery } = require('./common');
const { SKILL_LEVELS, SKILL_CATEGORIES } = require('../config/constants');

const skill = z.object({
  name: z.string().trim().min(1, 'Skill name is required').max(60),
  category: z.enum(SKILL_CATEGORIES).default('other'),
  level: z.enum(SKILL_LEVELS).default('beginner'),
});

const availability = z.enum(['online', 'in-person', 'both']);

const updateProfile = z
  .object({
    name: z.string().trim().min(2).max(80),
    bio: z.string().trim().max(500),
    avatarUrl: z.union([z.literal(''), z.url('Avatar must be a valid URL')]),
    location: z.object({
      city: z.string().trim().max(80).default(''),
      country: z.string().trim().max(80).default(''),
    }),
    availability,
    languages: z.array(z.string().trim().min(1).max(40)).max(10),
    skillsOffered: z.array(skill).max(15),
    skillsWanted: z.array(skill).max(15),
  })
  .partial()
  .strict();

const explore = z.object({
  q: z.string().trim().max(100).optional(),
  // Search what people teach ("offered") or what they want to learn ("wanted").
  type: z.enum(['offered', 'wanted']).default('offered'),
  category: z.enum(SKILL_CATEGORIES).optional(),
  level: z.enum(SKILL_LEVELS).optional(),
  availability: z.enum(['online', 'in-person']).optional(),
  city: z.string().trim().max(80).optional(),
  ...pageQuery,
});

module.exports = { updateProfile, explore };
