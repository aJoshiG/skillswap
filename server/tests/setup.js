process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

let replSet;

beforeAll(async () => {
  // A replica set (not a standalone server) so tests can use transactions later.
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  // mongodb driver 7.8 loads `os` via dynamic import(), which Jest's CommonJS sandbox rejects;
  // the handshake then goes out without client metadata and mongod refuses it. Supply `os` directly.
  await mongoose.connect(replSet.getUri(), { runtimeAdapters: { os: require('os') } });
  // Build indexes (text search, unique constraints) before tests rely on them.
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
});

afterEach(async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet?.stop();
});
