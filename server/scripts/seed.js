/* Seeds the database with demo users whose skills overlap, so Explore and Matching have data.
 * Usage: npm run seed   (WARNING: wipes users, requests, chats, sessions, credits and reviews)
 */
const mongoose = require('mongoose');
const env = require('../src/config/env');
const User = require('../src/models/User');
const RefreshToken = require('../src/models/RefreshToken');
const SwapRequest = require('../src/models/SwapRequest');
const Conversation = require('../src/models/Conversation');
const Message = require('../src/models/Message');
const Session = require('../src/models/Session');
const CreditTransaction = require('../src/models/CreditTransaction');
const Review = require('../src/models/Review');
const { WELCOME_CREDITS } = require('../src/config/constants');

const PASSWORD = 'password123';

const s = (name, category, level) => ({ name, category, level });

const avatar = (seed) =>
  `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}`;

const users = [
  {
    name: 'Demo User',
    email: 'demo@skillswap.dev',
    bio: 'Explorer account for trying SkillSwap. Web developer who wants to pick up music and languages.',
    location: { city: 'Pune', country: 'India' },
    availability: 'both',
    languages: ['English', 'Hindi'],
    skillsOffered: [
      s('JavaScript', 'programming', 'expert'),
      s('Angular', 'programming', 'intermediate'),
    ],
    skillsWanted: [s('Guitar', 'music', 'beginner'), s('Spanish', 'languages', 'beginner')],
  },
  {
    name: 'Riya Sharma',
    bio: 'Classical guitarist for 10 years. Trying to move into tech.',
    location: { city: 'Pune', country: 'India' },
    availability: 'both',
    languages: ['English', 'Hindi', 'Marathi'],
    skillsOffered: [s('Guitar', 'music', 'expert'), s('Music Theory', 'music', 'intermediate')],
    skillsWanted: [
      s('JavaScript', 'programming', 'beginner'),
      s('Python', 'programming', 'beginner'),
    ],
  },
  {
    name: 'Carlos Mendez',
    bio: 'Native Spanish speaker, part-time chef, full-time foodie.',
    location: { city: 'Madrid', country: 'Spain' },
    availability: 'online',
    languages: ['Spanish', 'English'],
    skillsOffered: [s('Spanish', 'languages', 'expert'), s('Paella & Tapas', 'cooking', 'expert')],
    skillsWanted: [s('Angular', 'programming', 'beginner'), s('UI Design', 'design', 'beginner')],
  },
  {
    name: 'Aisha Khan',
    bio: 'Product designer who loves clean interfaces and data viz.',
    location: { city: 'Bengaluru', country: 'India' },
    availability: 'online',
    languages: ['English', 'Urdu'],
    skillsOffered: [s('UI Design', 'design', 'expert'), s('Figma', 'design', 'expert')],
    skillsWanted: [s('Python', 'programming', 'intermediate'), s('Yoga', 'fitness', 'beginner')],
  },
  {
    name: 'Kabir Mehta',
    bio: 'Data scientist. Weekend yoga teacher.',
    location: { city: 'Mumbai', country: 'India' },
    availability: 'both',
    languages: ['English', 'Hindi'],
    skillsOffered: [s('Python', 'programming', 'expert'), s('Yoga', 'fitness', 'intermediate')],
    skillsWanted: [s('UI Design', 'design', 'beginner'), s('Guitar', 'music', 'beginner')],
  },
  {
    name: 'Emma Wilson',
    bio: 'Piano teacher and amateur photographer.',
    location: { city: 'London', country: 'UK' },
    availability: 'online',
    languages: ['English', 'French'],
    skillsOffered: [s('Piano', 'music', 'expert'), s('Photography', 'arts', 'intermediate')],
    skillsWanted: [
      s('Spanish', 'languages', 'beginner'),
      s('JavaScript', 'programming', 'beginner'),
    ],
  },
  {
    name: 'Kenji Tanaka',
    bio: 'Backend engineer in Tokyo, learning to cook Indian food.',
    location: { city: 'Tokyo', country: 'Japan' },
    availability: 'online',
    languages: ['Japanese', 'English'],
    skillsOffered: [s('Japanese', 'languages', 'expert'), s('Go', 'programming', 'expert')],
    skillsWanted: [s('Indian Cooking', 'cooking', 'beginner'), s('Guitar', 'music', 'beginner')],
  },
  {
    name: 'Priya Nair',
    bio: 'Home chef who runs a small catering business.',
    location: { city: 'Pune', country: 'India' },
    availability: 'in-person',
    languages: ['English', 'Malayalam', 'Hindi'],
    skillsOffered: [
      s('Indian Cooking', 'cooking', 'expert'),
      s('Baking', 'cooking', 'intermediate'),
    ],
    skillsWanted: [
      s('Digital Marketing', 'business', 'beginner'),
      s('Photography', 'arts', 'beginner'),
    ],
  },
  {
    name: 'Lucas Martin',
    bio: 'Growth marketer and French tutor.',
    location: { city: 'Paris', country: 'France' },
    availability: 'online',
    languages: ['French', 'English'],
    skillsOffered: [
      s('Digital Marketing', 'business', 'expert'),
      s('French', 'languages', 'expert'),
    ],
    skillsWanted: [s('Japanese', 'languages', 'beginner'), s('Piano', 'music', 'beginner')],
  },
  {
    name: 'Sofia Rossi',
    bio: 'Illustrator. I sketch every single day.',
    location: { city: 'Milan', country: 'Italy' },
    availability: 'online',
    languages: ['Italian', 'English'],
    skillsOffered: [s('Illustration', 'arts', 'expert'), s('Italian', 'languages', 'expert')],
    skillsWanted: [s('Figma', 'design', 'intermediate'), s('French', 'languages', 'beginner')],
  },
  {
    name: 'Arjun Reddy',
    bio: 'Competitive programmer and maths tutor.',
    location: { city: 'Hyderabad', country: 'India' },
    availability: 'both',
    languages: ['English', 'Telugu'],
    skillsOffered: [
      s('Data Structures', 'programming', 'expert'),
      s('Calculus', 'academics', 'expert'),
    ],
    skillsWanted: [s('Public Speaking', 'business', 'beginner'), s('Guitar', 'music', 'beginner')],
  },
  {
    name: 'Grace Lee',
    bio: 'Toastmasters coach. Helping people find their voice.',
    location: { city: 'Singapore', country: 'Singapore' },
    availability: 'online',
    languages: ['English', 'Mandarin'],
    skillsOffered: [
      s('Public Speaking', 'business', 'expert'),
      s('Mandarin', 'languages', 'expert'),
    ],
    skillsWanted: [
      s('Data Structures', 'programming', 'beginner'),
      s('Baking', 'cooking', 'beginner'),
    ],
  },
  {
    name: 'Omar Haddad',
    bio: 'Personal trainer and calisthenics nerd.',
    location: { city: 'Dubai', country: 'UAE' },
    availability: 'both',
    languages: ['Arabic', 'English'],
    skillsOffered: [
      s('Strength Training', 'fitness', 'expert'),
      s('Arabic', 'languages', 'expert'),
    ],
    skillsWanted: [s('Python', 'programming', 'beginner'), s('Photography', 'arts', 'beginner')],
  },
  {
    name: 'Neha Gupta',
    bio: 'Chartered accountant who wants a creative hobby.',
    location: { city: 'Delhi', country: 'India' },
    availability: 'online',
    languages: ['English', 'Hindi'],
    skillsOffered: [s('Personal Finance', 'business', 'expert'), s('Excel', 'business', 'expert')],
    skillsWanted: [s('Illustration', 'arts', 'beginner'), s('Piano', 'music', 'beginner')],
  },
  {
    name: 'Daniel Okafor',
    bio: 'Mobile developer and Afrobeats producer.',
    location: { city: 'Lagos', country: 'Nigeria' },
    availability: 'online',
    languages: ['English', 'Yoruba'],
    skillsOffered: [
      s('Flutter', 'programming', 'expert'),
      s('Music Production', 'music', 'intermediate'),
    ],
    skillsWanted: [
      s('UI Design', 'design', 'intermediate'),
      s('Personal Finance', 'business', 'beginner'),
    ],
  },
  {
    name: 'Meera Iyer',
    bio: 'Bharatanatyam dancer and Carnatic singer.',
    location: { city: 'Chennai', country: 'India' },
    availability: 'both',
    languages: ['English', 'Tamil'],
    skillsOffered: [
      s('Classical Dance', 'arts', 'expert'),
      s('Carnatic Vocals', 'music', 'intermediate'),
    ],
    skillsWanted: [s('JavaScript', 'programming', 'beginner'), s('Excel', 'business', 'beginner')],
  },
  {
    name: 'Tom Becker',
    bio: 'Physics PhD student who teaches German on the side.',
    location: { city: 'Berlin', country: 'Germany' },
    availability: 'online',
    languages: ['German', 'English'],
    skillsOffered: [s('German', 'languages', 'expert'), s('Physics', 'academics', 'expert')],
    skillsWanted: [
      s('Spanish', 'languages', 'intermediate'),
      s('Music Production', 'music', 'beginner'),
    ],
  },
  {
    name: 'Ananya Das',
    bio: 'Marathon runner and nutrition nerd.',
    location: { city: 'Kolkata', country: 'India' },
    availability: 'both',
    languages: ['English', 'Bengali'],
    skillsOffered: [
      s('Running Coaching', 'fitness', 'expert'),
      s('Nutrition', 'fitness', 'intermediate'),
    ],
    skillsWanted: [s('Angular', 'programming', 'beginner'), s('German', 'languages', 'beginner')],
  },
  {
    name: 'Mateo Silva',
    bio: 'Surf instructor turned frontend developer.',
    location: { city: 'Lisbon', country: 'Portugal' },
    availability: 'online',
    languages: ['Portuguese', 'English', 'Spanish'],
    skillsOffered: [
      s('React', 'programming', 'intermediate'),
      s('Portuguese', 'languages', 'expert'),
    ],
    skillsWanted: [
      s('Angular', 'programming', 'intermediate'),
      s('Strength Training', 'fitness', 'beginner'),
    ],
  },
  {
    name: 'Hana Kim',
    bio: 'Korean teacher and K-drama critic.',
    location: { city: 'Seoul', country: 'South Korea' },
    availability: 'online',
    languages: ['Korean', 'English'],
    skillsOffered: [s('Korean', 'languages', 'expert'), s('Calligraphy', 'arts', 'intermediate')],
    skillsWanted: [s('Guitar', 'music', 'beginner'), s('JavaScript', 'programming', 'beginner')],
  },
];

async function seed() {
  await mongoose.connect(env.mongoUri);
  await Promise.all([
    User.deleteMany({}),
    RefreshToken.deleteMany({}),
    SwapRequest.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
    Session.deleteMany({}),
    CreditTransaction.deleteMany({}),
    Review.deleteMany({}),
  ]);
  // syncIndexes (not just init) also drops indexes the schemas no longer define,
  // e.g. the old unique index on Conversation.request.
  for (const model of [
    User,
    RefreshToken,
    SwapRequest,
    Conversation,
    Message,
    Session,
    CreditTransaction,
    Review,
  ]) {
    await model.syncIndexes();
  }

  const now = Date.now();
  const created = [];
  for (const [i, u] of users.entries()) {
    const email = u.email || `${u.name.split(' ')[0].toLowerCase()}@skillswap.dev`;
    created.push(
      await User.create({
        ...u,
        email,
        password: PASSWORD,
        avatarUrl: avatar(u.name),
        lastActiveAt: new Date(now - i * 3_600_000),
      }),
    );
  }

  // A few requests so the demo account's inboxes and chat aren't empty.
  const [demo, riya, carlos, , kabir] = created;
  await SwapRequest.create({
    from: carlos._id,
    to: demo._id,
    skill: { name: 'Angular', category: 'programming', level: 'intermediate' },
    offeredSkill: { name: 'Spanish', category: 'languages', level: 'expert' },
    message: 'Hola! I can teach you Spanish if you help me get started with Angular.',
  });
  await SwapRequest.create({
    from: demo._id,
    to: kabir._id,
    skill: { name: 'Python', category: 'programming', level: 'expert' },
    message: 'Would love to learn some Python for scripting.',
  });
  const accepted = await SwapRequest.create({
    from: riya._id,
    to: demo._id,
    skill: { name: 'JavaScript', category: 'programming', level: 'expert' },
    offeredSkill: { name: 'Guitar', category: 'music', level: 'expert' },
    message: 'Guitar for JavaScript? Sounds like a fair trade!',
    status: 'accepted',
    respondedAt: new Date(),
  });
  const conversation = await Conversation.create({
    participants: [riya._id, demo._id],
    request: accepted._id,
  });
  const lines = [
    [riya, 'Hey! Thanks for accepting 🎸'],
    [demo, 'Of course! When works for a first session?'],
    [riya, 'How about Saturday morning? I can bring a spare guitar.'],
  ];
  let last;
  for (const [i, [sender, text]] of lines.entries()) {
    last = await Message.create({
      conversation: conversation._id,
      sender: sender._id,
      text,
      createdAt: new Date(now - (lines.length - i) * 60_000),
      readAt: sender === demo ? new Date() : null,
    });
  }
  conversation.lastMessage = { text: last.text, sender: last.sender, createdAt: last.createdAt };
  await conversation.save();

  await seedSessionsAndCredits({ created, demo, riya, accepted, now });

  console.log(`Seeded ${created.length} users. Log in as demo@skillswap.dev / ${PASSWORD}`);
  await mongoose.disconnect();
}

/**
 * Time credits: everyone gets the welcome credits, then Demo and Riya have a short history on their
 * accepted swap (two completed lessons, one upcoming, one proposal waiting for Demo). The ledger is
 * written entry by entry, so each user's ledger adds up to their balance, like in the app.
 */
async function seedSessionsAndCredits({ created, demo, riya, accepted, now }) {
  const day = 24 * 3600 * 1000;
  const balance = new Map(created.map((u) => [String(u._id), 0]));
  const entries = [];
  const ledger = (user, amount, type, session, at) => {
    const after = balance.get(String(user._id)) + amount;
    balance.set(String(user._id), after);
    entries.push({
      user: user._id,
      amount,
      balanceAfter: after,
      type,
      session,
      createdAt: new Date(at),
    });
  };
  // Welcome credits: dated two weeks back, before the lessons below.
  for (const u of created) ledger(u, WELCOME_CREDITS, 'welcome', null, now - 14 * day);

  const guitar = accepted.offeredSkill; // Riya teaches Demo
  const javascript = accepted.skill; // Demo teaches Riya
  const session = (teacher, learner, skill, at, minutes, extra) =>
    Session.create({
      request: accepted._id,
      teacher: teacher._id,
      learner: learner._id,
      skill,
      scheduledAt: new Date(at),
      durationMinutes: minutes,
      credits: minutes / 60,
      mode: 'online',
      proposedBy: learner._id,
      ...extra,
    });

  const completed = { status: 'completed', confirmedBy: [demo._id, riya._id] };
  const lesson1 = await session(riya, demo, guitar, now - 5 * day, 60, {
    ...completed,
    note: 'First chords: G, C, D and Em',
    completedAt: new Date(now - 5 * day + 3600e3),
  });
  ledger(demo, -1, 'session-hold', lesson1._id, now - 6 * day);
  ledger(riya, 1, 'session-earned', lesson1._id, now - 5 * day + 3600e3);

  const lesson2 = await session(demo, riya, javascript, now - 3 * day, 90, {
    ...completed,
    note: 'Variables, functions and the DOM',
    completedAt: new Date(now - 3 * day + 5400e3),
  });
  ledger(riya, -1.5, 'session-hold', lesson2._id, now - 4 * day);
  ledger(demo, 1.5, 'session-earned', lesson2._id, now - 3 * day + 5400e3);

  const upcoming = await session(demo, riya, javascript, now + 2 * day, 60, {
    status: 'scheduled',
    note: 'Fetch and async/await',
    respondedAt: new Date(now - day),
  });
  ledger(riya, -1, 'session-hold', upcoming._id, now - day);

  // Waiting for Demo to accept: Riya offers a guitar lesson in person in Pune.
  await session(riya, demo, guitar, now + 4 * day, 60, {
    mode: 'in-person',
    proposedBy: riya._id,
    note: 'Café near FC Road? I will bring a spare guitar.',
  });

  // Reviews. Demo hasn't reviewed the JavaScript lesson yet, so the demo account sees a
  // "Leave a review" button in its session history.
  const reviews = [];
  const rate = (lesson, reviewer, reviewee, role, rating, comment, at) =>
    reviews.push({
      session: lesson._id,
      reviewer: reviewer._id,
      reviewee: reviewee._id,
      role,
      skill: { name: lesson.skill.name },
      rating,
      comment,
      createdAt: new Date(at),
      updatedAt: new Date(at),
    });
  rate(
    lesson1,
    demo,
    riya,
    'teacher',
    5,
    'So patient! I played my first full song after two lessons.',
    now - 5 * day + 2 * 3600e3,
  );
  rate(
    lesson1,
    riya,
    demo,
    'learner',
    5,
    'Came prepared and practised between lessons. A joy to teach.',
    now - 5 * day + 3 * 3600e3,
  );
  rate(
    lesson2,
    riya,
    demo,
    'teacher',
    5,
    'Explains JavaScript like a friend, not a textbook. Great examples.',
    now - 3 * day + 2 * 3600e3,
  );

  // A few completed lessons between other members, so ratings show up across Explore and Matches.
  const byName = new Map(created.map((u) => [u.name.split(' ')[0], u]));
  const pastLessons = [
    ['Kabir', 'Aisha', 'Python', 60, 5, 'Made Python finally click. Clear, practical and fun.', 9],
    [
      'Aisha',
      'Kabir',
      'UI Design',
      60,
      5,
      'Brilliant eye for layout. My portfolio looks 10x better.',
      8,
    ],
    ['Carlos', 'Emma', 'Spanish', 60, 5, '¡Excelente! Lots of real conversation practice.', 7],
    [
      'Carlos',
      'Tom',
      'Spanish',
      90,
      4,
      'Very good teacher, though we sometimes went off topic.',
      6,
    ],
    [
      'Kenji',
      'Lucas',
      'Japanese',
      60,
      5,
      'Hiragana in one session. Kenji is a natural teacher.',
      5,
    ],
    [
      'Grace',
      'Arjun',
      'Public Speaking',
      60,
      4,
      'Useful drills and honest feedback on my talk.',
      4,
    ],
    [
      'Neha',
      'Daniel',
      'Personal Finance',
      60,
      3,
      'Good content, but we ran over time and rushed the end.',
      3,
    ],
  ];
  for (const [
    teacherName,
    learnerName,
    skillName,
    minutes,
    rating,
    comment,
    daysAgo,
  ] of pastLessons) {
    const teacher = byName.get(teacherName);
    const learner = byName.get(learnerName);
    const skill = teacher.skillsOffered.find((s) => s.name === skillName);
    const at = now - daysAgo * day;
    const swap = await SwapRequest.create({
      from: learner._id,
      to: teacher._id,
      skill: { name: skill.name, category: skill.category, level: skill.level },
      status: 'accepted',
      respondedAt: new Date(at - 2 * day),
    });
    const lesson = await Session.create({
      request: swap._id,
      teacher: teacher._id,
      learner: learner._id,
      skill: { name: skill.name, category: skill.category, level: skill.level },
      scheduledAt: new Date(at),
      durationMinutes: minutes,
      credits: minutes / 60,
      mode: 'online',
      proposedBy: learner._id,
      status: 'completed',
      confirmedBy: [teacher._id, learner._id],
      completedAt: new Date(at + minutes * 60e3),
    });
    ledger(learner, -minutes / 60, 'session-hold', lesson._id, at - day);
    ledger(teacher, minutes / 60, 'session-earned', lesson._id, at + minutes * 60e3);
    rate(lesson, learner, teacher, 'teacher', rating, comment, at + 2 * 3600e3);
  }

  await CreditTransaction.collection.insertMany(entries);
  await Review.collection.insertMany(reviews);
  // Reputation stats derived from the reviews above, like the app's $inc on each review.
  const stats = new Map();
  for (const r of reviews) {
    const s = stats.get(String(r.reviewee)) ?? { count: 0, sum: 0 };
    stats.set(String(r.reviewee), { count: s.count + 1, sum: s.sum + r.rating });
  }
  await Promise.all(
    [...balance].map(([id, credits]) =>
      User.updateOne(
        { _id: id },
        { $set: { credits, reviewStats: stats.get(id) ?? { count: 0, sum: 0 } } },
      ),
    ),
  );
}

seed().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
