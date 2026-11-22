const request = require('supertest');
const { createApp } = require('../src/app');

// Register every model so setup.js can build their indexes.
require('../src/models/User');
require('../src/models/RefreshToken');
require('../src/models/SwapRequest');
require('../src/models/Conversation');
require('../src/models/Message');

const app = createApp();
const api = () => request(app);

let counter = 0;

/** Registers a user, optionally fills in their profile, and returns { user, token, cookie }. */
async function createUser(profile = {}) {
  counter += 1;
  const credentials = {
    name: profile.name || `User ${counter}`,
    email: `user${counter}@test.dev`,
    password: 'password123',
  };
  const res = await api().post('/api/auth/register').send(credentials).expect(201);
  const token = res.body.data.accessToken;
  const cookie = res.headers['set-cookie'];

  let user = res.body.data.user;
  const { name: _name, ...rest } = profile;
  if (Object.keys(rest).length) {
    const updated = await api()
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send(rest)
      .expect(200);
    user = updated.body.data;
  }
  return { user, token, cookie, credentials };
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { app, api, createUser, auth };
