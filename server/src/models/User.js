const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { SKILL_LEVELS, SKILL_CATEGORIES } = require('../config/constants');

const skillSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    category: { type: String, enum: SKILL_CATEGORIES, default: 'other' },
    level: { type: String, enum: SKILL_LEVELS, default: 'beginner' },
  },
  { _id: true },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    bio: { type: String, trim: true, maxlength: 500, default: '' },
    avatarUrl: { type: String, trim: true, default: '' },
    location: {
      city: { type: String, trim: true, default: '' },
      country: { type: String, trim: true, default: '' },
    },
    // Where the user is happy to swap: online, in person, or both.
    availability: { type: String, enum: ['online', 'in-person', 'both'], default: 'online' },
    languages: { type: [String], default: [] },
    skillsOffered: { type: [skillSchema], default: [] },
    skillsWanted: { type: [skillSchema], default: [] },
    lastActiveAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Full-text search across names, bios and skill names.
userSchema.index(
  { name: 'text', bio: 'text', 'skillsOffered.name': 'text', 'skillsWanted.name': 'text' },
  {
    name: 'user_text_search',
    weights: { 'skillsOffered.name': 5, 'skillsWanted.name': 3, name: 2, bio: 1 },
  },
);
userSchema.index({ 'skillsOffered.category': 1, 'skillsOffered.level': 1 });
userSchema.index({ 'skillsWanted.category': 1 });
// Smart matching looks skills up by name, case-insensitively; these indexes share that collation.
const caseInsensitive = { locale: 'en', strength: 2 };
userSchema.index({ 'skillsOffered.name': 1 }, { collation: caseInsensitive });
userSchema.index({ 'skillsWanted.name': 1 }, { collation: caseInsensitive });

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
