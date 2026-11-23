const { api, createUser, auth } = require('./helpers');

const skill = (name, level = 'intermediate', category = 'other') => ({ name, category, level });

/** Me: teaches JavaScript, wants Guitar + Spanish, lives in Pune, happy online or in person. */
const me = () =>
  createUser({
    name: 'Me',
    location: { city: 'Pune', country: 'India' },
    availability: 'both',
    skillsOffered: [skill('JavaScript', 'expert')],
    skillsWanted: [skill('Guitar'), skill('Spanish')],
  });

const matches = (user, query = '') =>
  api().get(`/api/users/matches${query}`).set(auth(user.token)).expect(200);

describe('Smart matching', () => {
  it('ranks two-way swaps above one-way matches and explains each match', async () => {
    const self = await me();
    // Two-way: teaches what I want AND wants what I teach (different letter case on purpose).
    await createUser({
      name: 'Mutual',
      availability: 'online',
      skillsOffered: [skill('guitar', 'expert')],
      skillsWanted: [skill('javascript')],
    });
    // One-way: only teaches something I want.
    await createUser({ name: 'Teacher', skillsOffered: [skill('Spanish')] });
    // One-way: only wants something I teach.
    await createUser({ name: 'Learner', skillsWanted: [skill('JavaScript')] });
    // No overlap at all: must not appear.
    await createUser({
      name: 'Stranger',
      skillsOffered: [skill('Pottery')],
      skillsWanted: [skill('Chess')],
    });

    const res = await matches(self);
    const names = res.body.data.map((u) => u.name);
    expect(names[0]).toBe('Mutual');
    expect(names).toEqual(expect.arrayContaining(['Teacher', 'Learner']));
    expect(names).not.toContain('Stranger');
    expect(names).not.toContain('Me');
    expect(res.body.meta.total).toBe(3);

    const [top] = res.body.data;
    expect(top.match).toMatchObject({ mutual: true, canMeetOnline: true, canMeetInPerson: false });
    expect(top.match.theyTeach.map((s) => s.name)).toEqual(['guitar']);
    expect(top.match.theyWant.map((s) => s.name)).toEqual(['javascript']);

    const teacher = res.body.data.find((u) => u.name === 'Teacher');
    expect(teacher.match.mutual).toBe(false);
    expect(teacher.match.theyWant).toEqual([]);
    // Private fields never leak.
    expect(top.email).toBeUndefined();
    expect(top.password).toBeUndefined();
  });

  it('prefers people you can meet in person in the same city', async () => {
    const self = await me();
    const base = { skillsOffered: [skill('Guitar')], availability: 'both' };
    await createUser({ ...base, name: 'Far', location: { city: 'Delhi', country: 'India' } });
    await createUser({ ...base, name: 'Near', location: { city: 'pune', country: 'India' } });

    const res = await matches(self);
    expect(res.body.data.map((u) => u.name)).toEqual(['Near', 'Far']);
    expect(res.body.data[0].match.canMeetInPerson).toBe(true);
    expect(res.body.data[1].match.canMeetInPerson).toBe(false);
  });

  it('shows an existing pending or accepted swap with each match', async () => {
    const self = await me();
    const riya = await createUser({ name: 'Riya', skillsOffered: [skill('Guitar')] });
    await api()
      .post('/api/requests')
      .set(auth(self.token))
      .send({ to: riya.user._id, skillId: riya.user.skillsOffered[0]._id })
      .expect(201);

    const [match] = (await matches(self)).body.data;
    expect(match.swap).toMatchObject({ status: 'pending', from: self.user._id });
  });

  it('paginates', async () => {
    const self = await me();
    for (let i = 0; i < 5; i += 1) {
      await createUser({ name: `Guitarist ${i}`, skillsOffered: [skill('Guitar')] });
    }
    const res = await matches(self, '?limit=2&page=3');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toMatchObject({ page: 3, limit: 2, total: 5, totalPages: 3 });
  });

  it('returns nothing for a user with no skills, and requires login', async () => {
    const empty = await createUser({ name: 'Empty' });
    await createUser({ name: 'Someone', skillsOffered: [skill('Guitar')] });
    const res = await matches(empty);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);

    await api().get('/api/users/matches').expect(401);
  });
});
