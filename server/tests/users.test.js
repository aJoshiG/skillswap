const { api, createUser, auth } = require('./helpers');

describe('Profiles & Explore', () => {
  it('updates the profile and validates input', async () => {
    const { token } = await createUser();
    const res = await api()
      .patch('/api/users/me')
      .set(auth(token))
      .send({
        bio: 'I love teaching',
        availability: 'both',
        location: { city: 'Pune', country: 'India' },
        skillsOffered: [{ name: 'Guitar', category: 'music', level: 'expert' }],
      })
      .expect(200);
    expect(res.body.data.skillsOffered[0]).toMatchObject({ name: 'Guitar', level: 'expert' });

    await api()
      .patch('/api/users/me')
      .set(auth(token))
      .send({ skillsOffered: [{ name: 'X', level: 'godlike' }] })
      .expect(400);
    await api().patch('/api/users/me').set(auth(token)).send({ email: 'x@y.z' }).expect(400);
  });

  it('public profiles do not expose email', async () => {
    const { user } = await createUser({ bio: 'hi' });
    const { token } = await createUser();
    const res = await api().get(`/api/users/${user._id}`).set(auth(token)).expect(200);
    expect(res.body.data.name).toBe(user.name);
    expect(res.body.data.email).toBeUndefined();
  });

  it('explores by text search, filters and pagination, excluding yourself', async () => {
    const { token } = await createUser({
      skillsOffered: [{ name: 'Python', category: 'programming', level: 'expert' }],
    });
    await createUser({
      name: 'Riya',
      availability: 'online',
      skillsOffered: [{ name: 'Python', category: 'programming', level: 'expert' }],
    });
    await createUser({
      name: 'Kabir',
      availability: 'in-person',
      location: { city: 'Mumbai', country: 'India' },
      skillsOffered: [{ name: 'Guitar', category: 'music', level: 'beginner' }],
    });
    await createUser({ name: 'No skills' });

    const all = await api().get('/api/users').set(auth(token)).expect(200);
    expect(all.body.data.map((u) => u.name).sort()).toEqual(['Kabir', 'Riya']);

    const search = await api().get('/api/users?q=python').set(auth(token)).expect(200);
    expect(search.body.data.map((u) => u.name)).toEqual(['Riya']);

    const music = await api().get('/api/users?category=music').set(auth(token)).expect(200);
    expect(music.body.data.map((u) => u.name)).toEqual(['Kabir']);

    const online = await api().get('/api/users?availability=online').set(auth(token)).expect(200);
    expect(online.body.data.map((u) => u.name)).toEqual(['Riya']);

    const city = await api().get('/api/users?city=mumbai').set(auth(token)).expect(200);
    expect(city.body.data.map((u) => u.name)).toEqual(['Kabir']);

    const paged = await api().get('/api/users?limit=1&page=2').set(auth(token)).expect(200);
    expect(paged.body.data).toHaveLength(1);
    expect(paged.body.meta).toMatchObject({ page: 2, limit: 1, total: 2, totalPages: 2 });
  });
});
