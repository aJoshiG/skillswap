const { api, createUser, auth } = require('./helpers');

async function setup() {
  const teacher = await createUser({
    name: 'Teacher',
    skillsOffered: [{ name: 'Guitar', category: 'music', level: 'expert' }],
  });
  const learner = await createUser({
    name: 'Learner',
    skillsOffered: [{ name: 'Python', category: 'programming', level: 'intermediate' }],
  });
  return { teacher, learner, skillId: teacher.user.skillsOffered[0]._id };
}

const send = (from, body) => api().post('/api/requests').set(auth(from.token)).send(body);

describe('Swap requests', () => {
  it('sends a request with an offered skill and shows it in both inboxes', async () => {
    const { teacher, learner, skillId } = await setup();
    const res = await send(learner, {
      to: teacher.user._id,
      skillId,
      offeredSkillId: learner.user.skillsOffered[0]._id,
      message: 'Teach me please!',
    }).expect(201);

    expect(res.body.data).toMatchObject({
      status: 'pending',
      skill: { name: 'Guitar' },
      offeredSkill: { name: 'Python' },
    });

    const received = await api().get('/api/requests?box=received').set(auth(teacher.token));
    expect(received.body.data).toHaveLength(1);
    expect(received.body.data[0].from.name).toBe('Learner');

    const sent = await api().get('/api/requests?box=sent').set(auth(learner.token));
    expect(sent.body.data).toHaveLength(1);
  });

  it('blocks self-requests, unknown skills, foreign offered skills and duplicates', async () => {
    const { teacher, learner, skillId } = await setup();

    await send(teacher, { to: teacher.user._id, skillId }).expect(400);
    await send(learner, { to: teacher.user._id, skillId: learner.user.skillsOffered[0]._id }).expect(400);
    await send(learner, { to: teacher.user._id, skillId, offeredSkillId: skillId }).expect(400);

    await send(learner, { to: teacher.user._id, skillId }).expect(201);
    await send(learner, { to: teacher.user._id, skillId }).expect(409);
  });

  it('only the recipient can accept, which opens a conversation', async () => {
    const { teacher, learner, skillId } = await setup();
    const { body } = await send(learner, { to: teacher.user._id, skillId });
    const id = body.data._id;

    await api().patch(`/api/requests/${id}/accept`).set(auth(learner.token)).expect(403);

    const accepted = await api()
      .patch(`/api/requests/${id}/accept`)
      .set(auth(teacher.token))
      .expect(200);
    expect(accepted.body.data.request.status).toBe('accepted');
    expect(accepted.body.data.conversationId).toEqual(expect.any(String));

    // A request that is no longer pending can't change again.
    await api().patch(`/api/requests/${id}/decline`).set(auth(teacher.token)).expect(409);

    // After it's resolved, a new request for the same skill is allowed again.
    await send(learner, { to: teacher.user._id, skillId }).expect(201);
  });

  it('reuses one conversation per pair, whichever direction later swaps go', async () => {
    const { teacher, learner, skillId } = await setup();
    const accept = async (from, to, skill) => {
      const { body } = await send(from, { to: to.user._id, skillId: skill }).expect(201);
      const res = await api().patch(`/api/requests/${body.data._id}/accept`).set(auth(to.token)).expect(200);
      return res.body.data;
    };

    const first = await accept(learner, teacher, skillId);
    // A second swap, in the opposite direction, between the same two people.
    const second = await accept(teacher, learner, learner.user.skillsOffered[0]._id);
    expect(second.conversationId).toBe(first.conversationId);

    const list = await api().get('/api/conversations').set(auth(learner.token)).expect(200);
    expect(list.body.data).toHaveLength(1);
    // The thread points at the latest swap, so the chat header shows the current skills.
    expect(list.body.data[0].request.skill.name).toBe('Python');
  });

  it('only the sender can cancel, and declined requests do not open chats', async () => {
    const { teacher, learner, skillId } = await setup();
    const first = await send(learner, { to: teacher.user._id, skillId });
    await api().patch(`/api/requests/${first.body.data._id}/cancel`).set(auth(teacher.token)).expect(403);
    await api().patch(`/api/requests/${first.body.data._id}/cancel`).set(auth(learner.token)).expect(200);

    const second = await send(learner, { to: teacher.user._id, skillId });
    const declined = await api()
      .patch(`/api/requests/${second.body.data._id}/decline`)
      .set(auth(teacher.token))
      .expect(200);
    expect(declined.body.data.conversationId).toBeNull();

    const filtered = await api().get('/api/requests?box=sent&status=cancelled').set(auth(learner.token));
    expect(filtered.body.data).toHaveLength(1);
  });
});
