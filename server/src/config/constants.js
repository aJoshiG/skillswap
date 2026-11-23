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
// Reputation: a Bayesian average pulls ratings with few reviews toward this prior, so one
// 5-star review doesn't outrank a teacher with many 4.8s. New users count as the prior mean.
const REVIEW_PRIOR = { mean: 4, weight: 3 };

module.exports = {
  SKILL_LEVELS,
  SKILL_CATEGORIES,
  REQUEST_STATUS,
  WELCOME_CREDITS,
  SESSION_DURATIONS,
  SESSION_STATUS,
  CREDIT_TYPES,
  REVIEW_PRIOR,
};
