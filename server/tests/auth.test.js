const { api, createUser, auth } = require('./helpers');

const refreshCookie = (res) => res.headers['set-cookie'].find((c) => c.startsWith('ss_refresh='));

describe('Auth', () => {
  it('registers a user, returns an access token and sets an httpOnly refresh cookie', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Asha', email: 'ASHA@test.dev', password: 'password123' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user.email).toBe('asha@test.dev');
    expect(res.body.data.user.password).toBeUndefined();
    expect(refreshCookie(res)).toMatch(/HttpOnly/);
  });

  it('rejects invalid registration data with field details', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'A', email: 'not-an-email', password: 'short' })
      .expect(400);

    expect(res.body.error.code).toBe('BAD_REQUEST');
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it('rejects duplicate emails', async () => {
    const { credentials } = await createUser();
    await api().post('/api/auth/register').send(credentials).expect(409);
  });

  it('logs in with correct credentials and rejects wrong ones', async () => {
    const { credentials } = await createUser();
    await api().post('/api/auth/login').send(credentials).expect(200);
    const res = await api()
      .post('/api/auth/login')
      .send({ ...credentials, password: 'wrong-password' })
      .expect(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('protects routes and accepts a valid access token', async () => {
    await api().get('/api/auth/me').expect(401);
    await api().get('/api/auth/me').set(auth('garbage')).expect(401);

    const { token, user } = await createUser();
    const res = await api().get('/api/auth/me').set(auth(token)).expect(200);
    expect(res.body.data._id).toBe(user._id);
  });

  it('rotates refresh tokens and revokes all sessions when an old token is reused', async () => {
    const { cookie } = await createUser();

    const first = await api().post('/api/auth/refresh').set('Cookie', cookie).expect(200);
    expect(first.body.data.accessToken).toEqual(expect.any(String));
    const rotated = refreshCookie(first);
    expect(rotated).not.toBe(cookie[0]);

    // Reusing the original (now revoked) token is treated as theft.
    await api().post('/api/auth/refresh').set('Cookie', cookie).expect(401);
    // ...which also kills the newer token.
    await api().post('/api/auth/refresh').set('Cookie', rotated).expect(401);
  });

  it('logout revokes the refresh token', async () => {
    const { cookie } = await createUser();
    await api().post('/api/auth/logout').set('Cookie', cookie).expect(200);
    await api().post('/api/auth/refresh').set('Cookie', cookie).expect(401);
  });
});
