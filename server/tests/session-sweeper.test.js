const mongoose = require('mongoose');
const { api, createUser, auth } = require('./helpers');
const Session = require('../src/models/Session');
const User = require('../src/models/User');
const CreditTransaction = require('../src/models/CreditTransaction');
const { resolveOverdue } = require('../src/services/session.service');

const HOUR = 3600e3;
const DAY = 24 * HOUR;
const skill = (name) => ({ name, category: 'other', level: 'expert' });

/** A scheduled 60-minute Guitar session (credits held) that started at `startedAt`. */
async function scheduledSession(startedAt) {
  const teacher = await createUser({ name: 'Teacher', skillsOffered: [skill('Guitar')] });
  const learner = await createUser({ name: 'Learner' });
  const req = await api()
    .post('/api/requests')
    .set(auth(learner.token))
    .send({ to: teacher.user._id, skillId: teacher.user.skillsOffered[0]._id })
    .expect(201);
  await api()
    .patch(`/api/requests/${req.body.data._id}/accept`)
    .set(auth(teacher.token))
    .expect(200);
  const s = await api()
    .post('/api/sessions')
    .set(auth(learner.token))
    .send({
      requestId: req.body.data._id,
      skill: 'requested',
      scheduledAt: new Date(Date.now() + HOUR).toISOString(),
      durationMinutes: 60,
      mode: 'online',
    })
    .expect(201);
  const id = s.body.data._id;
  await api().patch(`/api/sessions/${id}/accept`).set(auth(teacher.token)).expect(200);
  await Session.updateOne({ _id: id }, { $set: { scheduledAt: startedAt } });
  return { teacher, learner, id };
}

const confirm = (user, id) => api().patch(`/api/sessions/${id}/confirm`).set(auth(user.token));
const balance = async (u) => (await User.findById(u.user._id).lean()).credits;
const status = async (id) => (await Session.findById(id).lean()).status;

async function expectLedgerMatches(u) {
  const [sum] = await CreditTransaction.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(u.user._id) } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  expect(sum.total).toBe(await balance(u));
}

describe('Session sweeper (auto-resolving overdue sessions)', () => {
  it('auto-completes and pays the teacher 3 days after the end if only one person confirmed', async () => {
    const start = new Date(Date.now() - 2 * HOUR); // started 2h ago, ended 1h ago
    const { teacher, learner, id } = await scheduledSession(start);
    await confirm(learner, id).expect(200);

    // Not yet: only 2 days after the end.
    await resolveOverdue(new Date(start.getTime() + HOUR + 2 * DAY));
    expect(await status(id)).toBe('scheduled');
    expect(await balance(teacher)).toBe(2);

    const later = new Date(start.getTime() + HOUR + 3 * DAY + 1000);
    const result = await resolveOverdue(later);
    expect(result).toMatchObject({ completed: 1, expired: 0 });
    const s = await Session.findById(id).lean();
    expect(s).toMatchObject({ status: 'completed', autoResolved: true });
    expect(await balance(teacher)).toBe(3);
    expect(await balance(learner)).toBe(1);
    await expectLedgerMatches(teacher);

    // Late confirmation after auto-completion is a clear conflict, not a second payment.
    await confirm(teacher, id).expect(409);
    expect(await balance(teacher)).toBe(3);
  });

  it('expires and refunds the learner 7 days after the end if nobody confirmed', async () => {
    const start = new Date(Date.now() - 2 * HOUR);
    const { teacher, learner, id } = await scheduledSession(start);
    expect(await balance(learner)).toBe(1); // 1 credit held

    await resolveOverdue(new Date(start.getTime() + HOUR + 6 * DAY));
    expect(await status(id)).toBe('scheduled');

    const result = await resolveOverdue(new Date(start.getTime() + HOUR + 7 * DAY + 1000));
    expect(result).toMatchObject({ completed: 0, expired: 1 });
    expect(await status(id)).toBe('expired');
    expect(await balance(learner)).toBe(2);
    expect(await balance(teacher)).toBe(2);
    await expectLedgerMatches(learner);
    const refund = await CreditTransaction.findOne({
      user: learner.user._id,
      type: 'session-refund',
    }).lean();
    expect(String(refund.session)).toBe(id);
  });

  it('is safe to run twice, or twice at the same time: the teacher is paid exactly once', async () => {
    const start = new Date(Date.now() - 2 * HOUR);
    const { teacher, learner, id } = await scheduledSession(start);
    await confirm(learner, id).expect(200);
    const later = new Date(start.getTime() + 4 * DAY);

    const [a, b] = await Promise.all([resolveOverdue(later), resolveOverdue(later)]);
    expect(a.completed + b.completed).toBe(1);
    const again = await resolveOverdue(later);
    expect(again.completed).toBe(0);

    expect(await balance(teacher)).toBe(3);
    const earned = await CreditTransaction.countDocuments({
      user: teacher.user._id,
      type: 'session-earned',
    });
    expect(earned).toBe(1);
    expect(await status(id)).toBe('completed');
  });

  it('expires proposals whose time has passed, moving no credits', async () => {
    const teacher = await createUser({ name: 'Teacher', skillsOffered: [skill('Guitar')] });
    const learner = await createUser({ name: 'Learner' });
    const req = await api()
      .post('/api/requests')
      .set(auth(learner.token))
      .send({ to: teacher.user._id, skillId: teacher.user.skillsOffered[0]._id })
      .expect(201);
    await api()
      .patch(`/api/requests/${req.body.data._id}/accept`)
      .set(auth(teacher.token))
      .expect(200);
    const s = await api()
      .post('/api/sessions')
      .set(auth(learner.token))
      .send({
        requestId: req.body.data._id,
        skill: 'requested',
        scheduledAt: new Date(Date.now() + HOUR).toISOString(),
        durationMinutes: 60,
        mode: 'online',
      })
      .expect(201);

    await resolveOverdue(new Date(Date.now() + 30 * 60e3)); // before its start: untouched
    expect(await status(s.body.data._id)).toBe('proposed');

    const result = await resolveOverdue(new Date(Date.now() + 2 * HOUR));
    expect(result.proposalsExpired).toBe(1);
    expect(await status(s.body.data._id)).toBe('expired');
    expect(await balance(learner)).toBe(2);
    await api()
      .patch(`/api/sessions/${s.body.data._id}/accept`)
      .set(auth(teacher.token))
      .expect(409);
  });

  it('leaves completed, cancelled and recent sessions alone', async () => {
    const recent = await scheduledSession(new Date(Date.now() - 2 * HOUR));
    const result = await resolveOverdue(new Date());
    expect(result).toEqual({ completed: 0, expired: 0, proposalsExpired: 0 });
    expect(await status(recent.id)).toBe('scheduled');
  });

  it('shows expired sessions in history', async () => {
    const start = new Date(Date.now() - 2 * HOUR);
    const { learner, id } = await scheduledSession(start);
    await resolveOverdue(new Date(start.getTime() + 8 * DAY));
    const history = await api()
      .get('/api/sessions?scope=history')
      .set(auth(learner.token))
      .expect(200);
    expect(history.body.data.map((s) => [s._id, s.status])).toEqual([[id, 'expired']]);
  });
});
