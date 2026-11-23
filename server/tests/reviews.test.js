const { api, createUser, auth } = require('./helpers');
const Session = require('../src/models/Session');
const User = require('../src/models/User');

const skill = (name) => ({ name, category: 'other', level: 'expert' });

/** Teacher teaches Guitar to Learner for `minutes`, and the session completes. */
async function completedSession({ minutes = 60, teacher, learner } = {}) {
  teacher ??= await createUser({ name: 'Teacher', skillsOffered: [skill('Guitar')] });
  learner ??= await createUser({ name: 'Learner' });
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
      scheduledAt: new Date(Date.now() + 3600e3).toISOString(),
      durationMinutes: minutes,
      mode: 'online',
    })
    .expect(201);
  const id = s.body.data._id;
  await api().patch(`/api/sessions/${id}/accept`).set(auth(teacher.token)).expect(200);
  await Session.updateOne({ _id: id }, { $set: { scheduledAt: new Date(Date.now() - 60_000) } });
  await api().patch(`/api/sessions/${id}/confirm`).set(auth(learner.token)).expect(200);
  await api().patch(`/api/sessions/${id}/confirm`).set(auth(teacher.token)).expect(200);
  return { teacher, learner, sessionId: id };
}

const review = (user, sessionId, body) =>
  api().post(`/api/sessions/${sessionId}/review`).set(auth(user.token)).send(body);
const profile = (viewer, user) =>
  api().get(`/api/users/${user.user._id}`).set(auth(viewer.token)).expect(200);

describe('Reviews and reputation', () => {
  it('lets both people review a completed session and updates reputation', async () => {
    const { teacher, learner, sessionId } = await completedSession({ minutes: 90 });

    const r = await review(learner, sessionId, {
      rating: 5,
      comment: '  Patient and clear!  ',
    }).expect(201);
    expect(r.body.data).toMatchObject({
      rating: 5,
      comment: 'Patient and clear!',
      role: 'teacher', // the reviewee's role in that session
      skill: { name: 'Guitar' },
    });
    await review(teacher, sessionId, { rating: 4 }).expect(201);

    const p = (await profile(learner, teacher)).body.data;
    expect(p.reviewStats).toEqual({ count: 1, sum: 5 });
    expect(p.teaching).toEqual({ sessions: 1, hours: 1.5 });
    expect((await profile(teacher, learner)).body.data.reviewStats).toEqual({ count: 1, sum: 4 });

    const list = await api()
      .get(`/api/users/${teacher.user._id}/reviews`)
      .set(auth(learner.token))
      .expect(200);
    expect(list.body.meta.total).toBe(1);
    expect(list.body.data[0]).toMatchObject({ rating: 5, reviewer: { name: 'Learner' } });
    expect(list.body.data[0].reviewer.email).toBeUndefined();
  });

  it('only allows one review per person per session, even when submitted twice at once', async () => {
    const { teacher, learner, sessionId } = await completedSession();
    const results = await Promise.all([
      review(learner, sessionId, { rating: 5 }),
      review(learner, sessionId, { rating: 3 }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    // The losing submission must not have touched the stats either.
    const stats = (await User.findById(teacher.user._id).lean()).reviewStats;
    expect(stats.count).toBe(1);
    expect([3, 5]).toContain(stats.sum);
  });

  it('rejects reviews before completion, from outsiders, and with invalid ratings', async () => {
    const { teacher, learner, sessionId } = await completedSession();
    const outsider = await createUser({ name: 'Outsider' });
    await review(outsider, sessionId, { rating: 5 }).expect(403);
    for (const rating of [0, 6, 4.5, 'five']) {
      await review(learner, sessionId, { rating }).expect(400);
    }
    await review(learner, sessionId, { rating: 5, comment: 'x'.repeat(501) }).expect(400);

    // A session that is only scheduled can't be reviewed yet.
    const req = await api()
      .post('/api/requests')
      .set(auth(learner.token))
      .send({ to: teacher.user._id, skillId: teacher.user.skillsOffered[0]._id })
      .expect(201);
    await api()
      .patch(`/api/requests/${req.body.data._id}/accept`)
      .set(auth(teacher.token))
      .expect(200);
    const upcoming = await api()
      .post('/api/sessions')
      .set(auth(learner.token))
      .send({
        requestId: req.body.data._id,
        skill: 'requested',
        scheduledAt: new Date(Date.now() + 3600e3).toISOString(),
        durationMinutes: 30,
        mode: 'online',
      })
      .expect(201);
    await review(learner, upcoming.body.data._id, { rating: 5 }).expect(409);
  });

  it('shows my review on my session history', async () => {
    const { learner, sessionId } = await completedSession();
    const before = await api()
      .get('/api/sessions?scope=history')
      .set(auth(learner.token))
      .expect(200);
    expect(before.body.data[0].myReview).toBeNull();
    await review(learner, sessionId, { rating: 4, comment: 'Good' }).expect(201);
    const after = await api()
      .get('/api/sessions?scope=history')
      .set(auth(learner.token))
      .expect(200);
    expect(after.body.data[0].myReview).toMatchObject({ rating: 4 });
  });

  it('ranks well-reviewed teachers higher in matches, using a Bayesian average', async () => {
    const me = await createUser({ name: 'Me', skillsWanted: [skill('Guitar')] });
    const base = { skillsOffered: [skill('Guitar')], availability: 'online' };
    const lucky = await createUser({ ...base, name: 'One lucky 5-star' });
    const proven = await createUser({ ...base, name: 'Twenty 4.8s' });
    const poor = await createUser({ ...base, name: 'Poorly rated' });
    await createUser({ ...base, name: 'New' });
    // Set reputations directly (the review flow itself is covered above).
    await User.updateOne({ _id: lucky.user._id }, { $set: { reviewStats: { count: 1, sum: 5 } } });
    await User.updateOne(
      { _id: proven.user._id },
      { $set: { reviewStats: { count: 20, sum: 96 } } },
    );
    await User.updateOne({ _id: poor.user._id }, { $set: { reviewStats: { count: 5, sum: 10 } } });

    const res = await api().get('/api/users/matches').set(auth(me.token)).expect(200);
    expect(res.body.data.map((u) => u.name)).toEqual([
      'Twenty 4.8s',
      'One lucky 5-star',
      'New',
      'Poorly rated',
    ]);
    expect(res.body.data[0].reviewStats).toEqual({ count: 20, sum: 96 });
  });
});
