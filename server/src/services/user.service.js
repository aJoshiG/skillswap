const mongoose = require('mongoose');
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
async function explore(
  currentUserId,
  { q, type, category, level, availability, city, page, limit },
) {
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

// Case-insensitive string comparison ("javascript" matches "JavaScript"). The skill-name indexes
// on User use the same collation, so the candidate $match below can use them.
const CASE_INSENSITIVE = { locale: 'en', strength: 2 };

const SCORE = {
  mutual: 100, // they teach what you want AND want what you teach
  perSkill: 20, // each skill that lines up, in either direction
  teacherLevel: { expert: 5, intermediate: 2, beginner: 0 }, // per skill they can teach you
  inPerson: 10, // same city, and both of you meet in person
  online: 5, // both of you swap online
};

const normalize = (skills) => [...new Set(skills.map((s) => s.name.trim().toLowerCase()))];
const canOnline = (availability) => availability === 'online' || availability === 'both';
const canInPerson = (availability) => availability === 'in-person' || availability === 'both';

/** Skills in `field` whose (lowercased) name is in `names`. */
const skillsIn = (field, names) => ({
  $filter: {
    input: `$${field}`,
    as: 's',
    cond: { $in: [{ $toLower: { $trim: { input: '$$s.name' } } }, names] },
  },
});

/**
 * Ranks other users by how well their skills line up with the current user's, in one
 * aggregation pipeline: candidate filter → matched skills per direction → score → sort →
 * paginate ($facet) → attach any existing swap between the two users ($lookup).
 */
async function matches(currentUserId, { page, limit }) {
  const me = await User.findById(currentUserId)
    .select('skillsOffered skillsWanted location availability')
    .lean();
  if (!me) throw ApiError.notFound('User not found');

  const iWant = normalize(me.skillsWanted);
  const iTeach = normalize(me.skillsOffered);
  if (!iWant.length && !iTeach.length) return { items: [], meta: pageMeta(page, limit, 0) };

  const myId = new mongoose.Types.ObjectId(String(currentUserId));
  const myCity = (me.location?.city || '').trim().toLowerCase();
  const iMeetOnline = canOnline(me.availability);
  const iMeetInPerson = canInPerson(me.availability) && myCity !== '';

  const pipeline = [
    // 1. Candidates: anyone teaching something I want, or wanting something I teach.
    {
      $match: {
        _id: { $ne: myId },
        $or: [
          { 'skillsOffered.name': { $in: me.skillsWanted.map((s) => s.name) } },
          { 'skillsWanted.name': { $in: me.skillsOffered.map((s) => s.name) } },
        ],
      },
    },
    // 2. Which skills line up in each direction, and which meeting formats work for both.
    {
      $addFields: {
        theyTeach: skillsIn('skillsOffered', iWant),
        theyWant: skillsIn('skillsWanted', iTeach),
        canMeetOnline: iMeetOnline ? { $in: ['$availability', ['online', 'both']] } : false,
        canMeetInPerson: iMeetInPerson
          ? {
              $and: [
                { $in: ['$availability', ['in-person', 'both']] },
                { $eq: [{ $toLower: { $trim: { input: '$location.city' } } }, myCity] },
              ],
            }
          : false,
      },
    },
    {
      $addFields: {
        mutual: {
          $and: [{ $gt: [{ $size: '$theyTeach' }, 0] }, { $gt: [{ $size: '$theyWant' }, 0] }],
        },
      },
    },
    // 3. Score: two-way swaps first, then more overlap, stronger teachers, compatible formats.
    {
      $addFields: {
        score: {
          $add: [
            { $cond: ['$mutual', SCORE.mutual, 0] },
            {
              $multiply: [
                SCORE.perSkill,
                { $add: [{ $size: '$theyTeach' }, { $size: '$theyWant' }] },
              ],
            },
            {
              $sum: {
                $map: {
                  input: '$theyTeach',
                  as: 's',
                  in: {
                    $switch: {
                      branches: [
                        { case: { $eq: ['$$s.level', 'expert'] }, then: SCORE.teacherLevel.expert },
                        {
                          case: { $eq: ['$$s.level', 'intermediate'] },
                          then: SCORE.teacherLevel.intermediate,
                        },
                      ],
                      default: SCORE.teacherLevel.beginner,
                    },
                  },
                },
              },
            },
            { $cond: ['$canMeetInPerson', SCORE.inPerson, 0] },
            { $cond: ['$canMeetOnline', SCORE.online, 0] },
          ],
        },
      },
    },
    { $sort: { score: -1, lastActiveAt: -1, _id: 1 } },
    // 4. One round trip for the page and the total.
    {
      $facet: {
        items: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          // 5. Only for this page: the latest open swap between us, if any.
          {
            $lookup: {
              from: 'swaprequests',
              let: { them: '$_id' },
              pipeline: [
                {
                  $match: {
                    status: { $in: ['pending', 'accepted'] },
                    $expr: {
                      $or: [
                        { $and: [{ $eq: ['$from', myId] }, { $eq: ['$to', '$$them'] }] },
                        { $and: [{ $eq: ['$from', '$$them'] }, { $eq: ['$to', myId] }] },
                      ],
                    },
                  },
                },
                { $sort: { createdAt: -1 } },
                { $limit: 1 },
                { $project: { _id: 1, status: 1, from: 1 } },
              ],
              as: 'swaps',
            },
          },
          {
            $project: {
              ...Object.fromEntries(PUBLIC_FIELDS.split(' ').map((f) => [f, 1])),
              match: {
                score: '$score',
                mutual: '$mutual',
                theyTeach: '$theyTeach',
                theyWant: '$theyWant',
                canMeetOnline: '$canMeetOnline',
                canMeetInPerson: '$canMeetInPerson',
              },
              swap: { $first: '$swaps' },
            },
          },
        ],
        total: [{ $count: 'n' }],
      },
    },
  ];

  const [result] = await User.aggregate(pipeline).collation(CASE_INSENSITIVE);
  const total = result.total[0]?.n ?? 0;
  return { items: result.items, meta: pageMeta(page, limit, total) };
}

module.exports = { getMe, updateMe, getPublicProfile, explore, matches, PUBLIC_FIELDS, SCORE };
