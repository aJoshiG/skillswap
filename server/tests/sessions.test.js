const mongoose = require('mongoose');
const { api, createUser, auth } = require('./helpers');
const Session = require('../src/models/Session');
const CreditTransaction = require('../src/models/CreditTransaction');
const User = require('../src/models/User');

const skill = (name) => ({ name, category: 'other', level: 'expert' });
const inHours = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString();

/** Teacher teaches Guitar, learner teaches Python; learner asked for Guitar (offering Python), accepted. */
async function swapPair() {
  const teacher = await createUser({ name: 'Teacher', skillsOffered: [skill('Guitar')] });
  const learner = await createUser({ name: 'Learner', skillsOffered: [skill('Python')] });
  const req = await api()
    .post('/api/requests')
    .set(auth(learner.token))
    .send({
      to: teacher.user._id,
      skillId: teacher.user.skillsOffered[0]._id,
      offeredSkillId: learner.user.skillsOffered[0]._id,
    })
    .expect(201);
  await api()
    .patch(`/api/requests/${req.body.data._id}/accept`)
    .set(auth(teacher.token))
    .expect(200);
  return { teacher, learner, requestId: req.body.data._id };
}

const propose = (user, body) => api().post('/api/sessions').set(auth(user.token)).send(body);
const act = (user, id, action) =>
  api().patch(`/api/sessions/${id}/${action}`).set(auth(user.token));
const balance = async (user) => (await User.findById(user.user._id).lean()).credits;
/** Moves a session's start time into the past, so it can be confirmed. */
const startNow = (id) =>
  Session.updateOne({ _id: id }, { $set: { scheduledAt: new Date(Date.now() - 60_000) } });

/** The ledger must always add up to the stored balance. */
async function expectLedgerMatches(user) {
  const [sum] = await CreditTransaction.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(user.user._id) } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  expect(sum?.total ?? 0).toBe(await balance(user));
}

describe('Sessions and time credits', () => {
  it('gives new users 2 welcome credits, recorded in the ledger', async () => {
    const user = await createUser();
    const res = await api().get('/api/credits').set(auth(user.token)).expect(200);
    expect(res.body.data).toMatchObject({ balance: 2, held: 0 });
    expect(res.body.data.transactions).toEqual([
      expect.objectContaining({ type: 'welcome', amount: 2 }),
    ]);
    await expectLedgerMatches(user);
  });

  it('runs the full lifecycle: propose → accept (hold) → both confirm → teacher paid', async () => {
    const { teacher, learner, requestId } = await swapPair();

    const proposed = await propose(learner, {
      requestId,
      skill: 'requested', // the Guitar the learner asked for: Teacher teaches
      scheduledAt: inHours(24),
      durationMinutes: 90,
      mode: 'online',
      note: 'Zoom link in chat',
    }).expect(201);
    const id = proposed.body.data._id;
    expect(proposed.body.data).toMatchObject({
      status: 'proposed',
      credits: 1.5,
      skill: { name: 'Guitar' },
    });
    expect(proposed.body.data.teacher._id).toBe(teacher.user._id);

    // The proposer can't accept their own proposal.
    await act(learner, id, 'accept').expect(403);
    await act(teacher, id, 'accept').expect(200);
    // Credits are held from the learner as soon as it's scheduled.
    expect(await balance(learner)).toBe(0.5);
    const credits = await api().get('/api/credits').set(auth(learner.token)).expect(200);
    expect(credits.body.data).toMatchObject({ balance: 0.5, held: 1.5 });

    // Can't confirm a session that hasn't started yet.
    await act(learner, id, 'confirm').expect(409);
    await startNow(id);
    const first = await act(learner, id, 'confirm').expect(200);
    expect(first.body.data.status).toBe('scheduled'); // waiting for the other person
    await act(learner, id, 'confirm').expect(409); // can't confirm twice
    const done = await act(teacher, id, 'confirm').expect(200);
    expect(done.body.data.status).toBe('completed');

    expect(await balance(teacher)).toBe(3.5);
    expect(await balance(learner)).toBe(0.5);
    await expectLedgerMatches(teacher);
    await expectLedgerMatches(learner);
  });

  it('either side can teach: the offered skill makes the requester the teacher', async () => {
    const { teacher, learner, requestId } = await swapPair();
    const res = await propose(teacher, {
      requestId,
      skill: 'offered', // the Python the learner offered: Learner teaches Teacher
      scheduledAt: inHours(48),
      durationMinutes: 60,
      mode: 'in-person',
    }).expect(201);
    expect(res.body.data.teacher._id).toBe(learner.user._id);
    expect(res.body.data.learner._id).toBe(teacher.user._id);
  });

  it('refuses to schedule what the learner cannot pay for, and changes nothing', async () => {
    const { teacher, learner, requestId } = await swapPair();
    const body = { requestId, skill: 'requested', durationMinutes: 90, mode: 'online' };
    const a = await propose(learner, { ...body, scheduledAt: inHours(24) }).expect(201);
    const b = await propose(learner, { ...body, scheduledAt: inHours(48) }).expect(201);

    await act(teacher, a.body.data._id, 'accept').expect(200);
    const res = await act(teacher, b.body.data._id, 'accept').expect(409);
    expect(res.body.error.message).toMatch(/enough credits/i);

    expect((await Session.findById(b.body.data._id)).status).toBe('proposed');
    expect(await balance(learner)).toBe(0.5);
    await expectLedgerMatches(learner);
  });

  it('never double-spends when two sessions are accepted at the same moment', async () => {
    const { teacher, learner, requestId } = await swapPair();
    const body = { requestId, skill: 'requested', durationMinutes: 90, mode: 'online' };
    const a = await propose(learner, { ...body, scheduledAt: inHours(24) }).expect(201);
    const b = await propose(learner, { ...body, scheduledAt: inHours(48) }).expect(201);

    const results = await Promise.all([
      act(teacher, a.body.data._id, 'accept'),
      act(teacher, b.body.data._id, 'accept'),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await balance(learner)).toBe(0.5);
    await expectLedgerMatches(learner);
  });

  it('pays the teacher exactly once when both confirm at the same moment', async () => {
    const { teacher, learner, requestId } = await swapPair();
    const s = await propose(learner, {
      requestId,
      skill: 'requested',
      scheduledAt: inHours(24),
      durationMinutes: 60,
      mode: 'online',
    }).expect(201);
    await act(teacher, s.body.data._id, 'accept').expect(200);
    await startNow(s.body.data._id);

    const results = await Promise.all([
      act(teacher, s.body.data._id, 'confirm'),
      act(learner, s.body.data._id, 'confirm'),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect((await Session.findById(s.body.data._id)).status).toBe('completed');
    expect(await balance(teacher)).toBe(3);
    await expectLedgerMatches(teacher);
    const earned = await CreditTransaction.countDocuments({
      user: teacher.user._id,
      type: 'session-earned',
    });
    expect(earned).toBe(1);
  });

  it('refunds the learner when a scheduled session is cancelled before it starts', async () => {
    const { teacher, learner, requestId } = await swapPair();
    const s = await propose(teacher, {
      requestId,
      skill: 'requested',
      scheduledAt: inHours(24),
      durationMinutes: 120,
      mode: 'online',
    }).expect(201);
    await act(learner, s.body.data._id, 'accept').expect(200);
    expect(await balance(learner)).toBe(0);

    await act(teacher, s.body.data._id, 'cancel').expect(200);
    expect(await balance(learner)).toBe(2);
    await expectLedgerMatches(learner);
    await act(learner, s.body.data._id, 'cancel').expect(409); // already cancelled
  });

  it('cannot cancel once the session has started', async () => {
    const { teacher, learner, requestId } = await swapPair();
    const s = await propose(learner, {
      requestId,
      skill: 'requested',
      scheduledAt: inHours(24),
      durationMinutes: 60,
      mode: 'online',
    }).expect(201);
    await act(teacher, s.body.data._id, 'accept').expect(200);
    await startNow(s.body.data._id);
    await act(learner, s.body.data._id, 'cancel').expect(409);
  });

  it('declining a proposal moves no credits', async () => {
    const { teacher, learner, requestId } = await swapPair();
    const s = await propose(learner, {
      requestId,
      skill: 'requested',
      scheduledAt: inHours(24),
      durationMinutes: 60,
      mode: 'online',
    }).expect(201);
    await act(teacher, s.body.data._id, 'decline').expect(200);
    expect(await balance(learner)).toBe(2);
    expect(await CreditTransaction.countDocuments({ user: learner.user._id })).toBe(1); // welcome only
  });

  it('validates proposals and keeps outsiders out', async () => {
    const { teacher, learner, requestId } = await swapPair();
    const outsider = await createUser({ name: 'Outsider' });
    const body = {
      requestId,
      skill: 'requested',
      scheduledAt: inHours(24),
      durationMinutes: 60,
      mode: 'online',
    };

    await propose(outsider, body).expect(403);
    await propose(learner, { ...body, scheduledAt: inHours(-1) }).expect(400); // in the past
    await propose(learner, { ...body, durationMinutes: 45 }).expect(400); // not a supported length

    const s = await propose(learner, body).expect(201);
    await act(outsider, s.body.data._id, 'accept').expect(403);
    await act(outsider, s.body.data._id, 'cancel').expect(403);

    // Sessions need an accepted swap, and 'offered' needs an offered skill.
    const other = await createUser({ name: 'Other', skillsOffered: [skill('Chess')] });
    const pending = await api()
      .post('/api/requests')
      .set(auth(learner.token))
      .send({ to: other.user._id, skillId: other.user.skillsOffered[0]._id })
      .expect(201);
    await propose(learner, { ...body, requestId: pending.body.data._id }).expect(409);
    await api()
      .patch(`/api/requests/${pending.body.data._id}/accept`)
      .set(auth(other.token))
      .expect(200);
    await propose(learner, { ...body, requestId: pending.body.data._id, skill: 'offered' }).expect(
      400,
    );

    // Lists show each person their own sessions only.
    const mine = await api().get('/api/sessions?scope=active').set(auth(teacher.token)).expect(200);
    expect(mine.body.data.map((x) => x._id)).toEqual([s.body.data._id]);
    const theirs = await api()
      .get('/api/sessions?scope=active')
      .set(auth(outsider.token))
      .expect(200);
    expect(theirs.body.data).toEqual([]);
  });
});
