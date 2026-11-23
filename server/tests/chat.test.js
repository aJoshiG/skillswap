const { api, createUser, auth } = require('./helpers');

async function openConversation() {
  const teacher = await createUser({
    name: 'Teacher',
    skillsOffered: [{ name: 'Guitar', category: 'music', level: 'expert' }],
  });
  const learner = await createUser({ name: 'Learner' });
  const outsider = await createUser({ name: 'Outsider' });

  const req = await api()
    .post('/api/requests')
    .set(auth(learner.token))
    .send({ to: teacher.user._id, skillId: teacher.user.skillsOffered[0]._id });
  const accepted = await api()
    .patch(`/api/requests/${req.body.data._id}/accept`)
    .set(auth(teacher.token));
  return { teacher, learner, outsider, conversationId: accepted.body.data.conversationId };
}

const sendMsg = (user, id, text) =>
  api().post(`/api/conversations/${id}/messages`).set(auth(user.token)).send({ text });

describe('Chat', () => {
  it('lists conversations with the other user and unread counts', async () => {
    const { teacher, learner, conversationId } = await openConversation();
    await sendMsg(learner, conversationId, 'Hi!').expect(201);
    await sendMsg(learner, conversationId, 'When are you free?').expect(201);

    const res = await api().get('/api/conversations').set(auth(teacher.token)).expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      otherUser: { name: 'Learner' },
      unreadCount: 2,
      lastMessage: { text: 'When are you free?' },
    });

    await api()
      .post(`/api/conversations/${conversationId}/read`)
      .set(auth(teacher.token))
      .expect(200);
    const after = await api().get('/api/conversations').set(auth(teacher.token));
    expect(after.body.data[0].unreadCount).toBe(0);
  });

  it('paginates message history with a cursor', async () => {
    const { learner, conversationId } = await openConversation();
    for (let i = 1; i <= 5; i += 1) {
      await sendMsg(learner, conversationId, `msg ${i}`).expect(201);
    }

    const first = await api()
      .get(`/api/conversations/${conversationId}/messages?limit=3`)
      .set(auth(learner.token))
      .expect(200);
    expect(first.body.data.map((m) => m.text)).toEqual(['msg 3', 'msg 4', 'msg 5']);
    expect(first.body.meta.hasMore).toBe(true);

    const older = await api()
      .get(
        `/api/conversations/${conversationId}/messages?limit=3&before=${first.body.meta.nextCursor}`,
      )
      .set(auth(learner.token))
      .expect(200);
    expect(older.body.data.map((m) => m.text)).toEqual(['msg 1', 'msg 2']);
    expect(older.body.meta.hasMore).toBe(false);
  });

  it('keeps outsiders out of conversations', async () => {
    const { outsider, conversationId } = await openConversation();
    await api()
      .get(`/api/conversations/${conversationId}/messages`)
      .set(auth(outsider.token))
      .expect(403);
    await sendMsg(outsider, conversationId, 'let me in').expect(403);
    await sendMsg(outsider, conversationId, '   ').expect(400);
  });
});
