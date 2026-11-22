const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { pageMeta } = require('../utils/pagination');

const PUBLIC_FIELDS =
  'name bio avatarUrl location availability languages skillsOffered skillsWanted lastActiveAt createdAt';

async function getMe(userId) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

async function updateMe(userId, updates) {
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: updates },
    { returnDocument: 'after', runValidators: true },
  );
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

async function getPublicProfile(userId) {
  const user = await User.findById(userId).select(PUBLIC_FIELDS);
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Browse users by the skills they offer (or want), with search, filters and pagination. */
async function explore(currentUserId, { q, type, category, level, availability, city, page, limit }) {
  const skillField = type === 'wanted' ? 'skillsWanted' : 'skillsOffered';
  const filter = { _id: { $ne: currentUserId }, [`${skillField}.0`]: { $exists: true } };

  if (category || level) {
    const match = {};
    if (category) match.category = category;
    if (level) match.level = level;
    filter[skillField] = { $elemMatch: match };
  }
  if (availability) filter.availability = { $in: [availability, 'both'] };
  if (city) filter['location.city'] = new RegExp(`^${escapeRegex(city)}$`, 'i');
  if (q) {
    // $text ranks results, but its index covers both skill lists, so also require a
    // match in the list being browsed (or in the name/bio).
    filter.$text = { $search: q };
    const words = q.split(/\s+/).filter(Boolean).map(escapeRegex).join('|');
    const pattern = new RegExp(words, 'i');
    filter.$or = [{ [`${skillField}.name`]: pattern }, { name: pattern }, { bio: pattern }];
  }

  const projection = q ? { score: { $meta: 'textScore' } } : {};
  const sort = q ? { score: { $meta: 'textScore' }, lastActiveAt: -1 } : { lastActiveAt: -1 };

  const [items, total] = await Promise.all([
    User.find(filter, projection)
      .select(PUBLIC_FIELDS)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  return { items, meta: pageMeta(page, limit, total) };
}

module.exports = { getMe, updateMe, getPublicProfile, explore, PUBLIC_FIELDS };
