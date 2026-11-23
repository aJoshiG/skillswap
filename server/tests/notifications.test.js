const { api, createUser, auth } = require('./helpers');
const Notification = require('../src/models/Notification');
const Session = require('../src/models/Session');

const skill = (name) => ({ name, category: 'other', level: 'expert' });
const list = (user, query = '') =>
  api().get(`/api/notifications${query}`).set(auth(user.token)).expect(200);
const unread = async (user) =>
  (await api().get('/api/notifications/unread-count').set(auth(user.token)).expect(200)).body.data
    .count;

/** Learner requests the teacher's Guitar; returns the request id. */
async function request(learner, teacher) {
  const res = await api()
    .post('/api/requests')
    .set(auth(learner.token))
    .send({ to: teacher.user._id, skillId: teacher.user.skillsOffered[0]._id })
    .expect(201);
  return res.body.data._id;
}

describe('Notifications', () => {
  it('notifies the right person at each step: request, accept, session, completion, review', async () => {
    const teacher = await createUser({ name: 'Teacher', skillsOffered: [skill('Guitar')] });
    const learner = await createUser({ name: 'Learner' });

    // Request → the teacher is notified, linking to their requests.
    const requestId = await request(learner, teacher);
    let [n] = (await list(teacher)).body.data;
    expect(n).toMatchObject({
      type: 'request:new',
      actor: { name: 'Learner' },
      data: { skill: 'Guitar' },
      link: '/requests',
      readAt: null,
    });
    expect(n.actor.email).toBeUndefined();
    expect(await unread(learner)).toBe(0); // the actor isn't notified about their own action

    // Accept → the learner is notified, linking straight to the chat.
    const accepted = await api()
      .patch(`/api/requests/${requestId}/accept`)
      .set(auth(teacher.token))
      .expect(200);
    [n] = (await list(learner)).body.data;
    expect(n).toMatchObject({ type: 'request:accepted', actor: { name: 'Teacher' } });
    expect(n.link).toBe(`/messages/${accepted.body.data.conversationId}`);

    // Session proposed by the learner → the teacher; accepted → the learner.
    const s = await api()
      .post('/api/sessions')
      .set(auth(learner.token))
      .send({
        requestId,
        skill: 'requested',
        scheduledAt: new Date(Date.now() + 3600e3).toISOString(),
        durationMinutes: 60,
        mode: 'online',
      })
      .expect(201);
    const id = s.body.data._id;
    expect((await list(teacher)).body.data[0]).toMatchObject({
      type: 'session:proposed',
      link: '/sessions',
    });
    await api().patch(`/api/sessions/${id}/accept`).set(auth(teacher.token)).expect(200);
    expect((await list(learner)).body.data[0]).toMatchObject({
      type: 'session:accepted',
      data: { skill: 'Guitar', credits: 1 },
    });

    // Both confirm → the first confirmer is told it completed when the other confirms.
    await Session.updateOne({ _id: id }, { $set: { scheduledAt: new Date(Date.now() - 60_000) } });
    await api().patch(`/api/sessions/${id}/confirm`).set(auth(learner.token)).expect(200);
    expect((await list(teacher)).body.data[0].type).toBe('session:confirmed');
    await api().patch(`/api/sessions/${id}/confirm`).set(auth(teacher.token)).expect(200);
    expect((await list(learner)).body.data[0].type).toBe('session:completed');

    // Review → the reviewee, linking to the reviews on their own profile.
    await api()
      .post(`/api/sessions/${id}/review`)
      .set(auth(learner.token))
      .send({ rating: 5 })
      .expect(201);
    [n] = (await list(teacher)).body.data;
    expect(n).toMatchObject({ type: 'review:new', data: { rating: 5, skill: 'Guitar' } });
    expect(n.link).toBe(`/users/${teacher.user._id}#reviews`);

    expect(await unread(teacher)).toBe(4); // request, proposed, confirmed, review
    expect(await unread(learner)).toBe(3); // accepted, session accepted, completed
  });

  it('lists newest first with pagination and an unread filter; marks read one by one or all', async () => {
    const teacher = await createUser({ name: 'Teacher', skillsOffered: [skill('Guitar')] });
    const learners = [];
    for (let i = 0; i < 3; i += 1) {
      learners.push(await createUser({ name: `Learner ${i}` }));
      await request(learners[i], teacher);
    }

    const page1 = await list(teacher, '?limit=2');
    expect(page1.body.data.map((n) => n.actor.name)).toEqual(['Learner 2', 'Learner 1']);
    expect(page1.body.meta).toMatchObject({ total: 3, totalPages: 2 });

    const first = page1.body.data[0]._id;
    const read = await api()
      .patch(`/api/notifications/${first}/read`)
      .set(auth(teacher.token))
      .expect(200);
    expect(read.body.data.readAt).toEqual(expect.any(String));
    expect(await unread(teacher)).toBe(2);
    expect((await list(teacher, '?unread=true')).body.data).toHaveLength(2);

    // Someone else's notification can't be read (or even confirmed to exist).
    await api().patch(`/api/notifications/${first}/read`).set(auth(learners[0].token)).expect(404);

    const all = await api()
      .patch('/api/notifications/read-all')
      .set(auth(teacher.token))
      .expect(200);
    expect(all.body.data.updated).toBe(2);
    expect(await unread(teacher)).toBe(0);
  });

  it('notifies both people when the sweeper resolves a session', async () => {
    const { resolveOverdue } = require('../src/services/session.service');
    const teacher = await createUser({ name: 'Teacher', skillsOffered: [skill('Guitar')] });
    const learner = await createUser({ name: 'Learner' });
    const requestId = await request(learner, teacher);
    await api().patch(`/api/requests/${requestId}/accept`).set(auth(teacher.token)).expect(200);
    const s = await api()
      .post('/api/sessions')
      .set(auth(learner.token))
      .send({
        requestId,
        skill: 'requested',
        scheduledAt: new Date(Date.now() + 3600e3).toISOString(),
        durationMinutes: 60,
        mode: 'online',
      })
      .expect(201);
    await api()
      .patch(`/api/sessions/${s.body.data._id}/accept`)
      .set(auth(teacher.token))
      .expect(200);
    await resolveOverdue(new Date(Date.now() + 9 * 24 * 3600e3));

    for (const user of [teacher, learner]) {
      const [n] = (await list(user)).body.data;
      expect(n).toMatchObject({ type: 'session:expired', actor: null });
    }
  });

  it('never lets a notification failure break the action that caused it', async () => {
    const teacher = await createUser({ name: 'Teacher', skillsOffered: [skill('Guitar')] });
    const learner = await createUser({ name: 'Learner' });
    const original = Notification.create;
    Notification.create = () => Promise.reject(new Error('notifications are down'));
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    let logged;
    try {
      await request(learner, teacher); // still 201
      logged = errors.mock.calls.length;
    } finally {
      Notification.create = original;
      errors.mockRestore();
    }
    expect(logged).toBeGreaterThan(0);
  });

  it('requires login and expires old notifications automatically', async () => {
    await api().get('/api/notifications').expect(401);
    await api().get('/api/notifications/unread-count').expect(401);
    const ttl = (await Notification.collection.indexes()).find((i) => i.expireAfterSeconds);
    expect(ttl).toMatchObject({ key: { createdAt: 1 }, expireAfterSeconds: 90 * 24 * 3600 });
  });
});
