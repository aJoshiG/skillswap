const SKILL_LEVELS = ['beginner', 'intermediate', 'expert'];

const SKILL_CATEGORIES = [
  'programming',
  'design',
  'music',
  'languages',
  'business',
  'fitness',
  'cooking',
  'arts',
  'academics',
  'other',
];

const REQUEST_STATUS = ['pending', 'accepted', 'declined', 'cancelled'];

// Time credits: 1 hour of teaching = 1 credit. New users start with a few to learn with first.
const WELCOME_CREDITS = 2;
const SESSION_DURATIONS = [30, 60, 90, 120]; // minutes
const SESSION_STATUS = ['proposed', 'scheduled', 'completed', 'declined', 'cancelled'];
const CREDIT_TYPES = ['welcome', 'session-hold', 'session-refund', 'session-earned'];

module.exports = {
  SKILL_LEVELS,
  SKILL_CATEGORIES,
  REQUEST_STATUS,
  WELCOME_CREDITS,
  SESSION_DURATIONS,
  SESSION_STATUS,
  CREDIT_TYPES,
};
