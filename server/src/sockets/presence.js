// In-memory presence tracking. A user can have several tabs open, so we count sockets.
// (For multiple server instances this would move to Redis with the socket.io Redis adapter.)
const connections = new Map();

/** Returns true when the user just came online. */
function add(userId) {
  const count = connections.get(userId) || 0;
  connections.set(userId, count + 1);
  return count === 0;
}

/** Returns true when the user's last socket disconnected. */
function remove(userId) {
  const count = (connections.get(userId) || 1) - 1;
  if (count <= 0) {
    connections.delete(userId);
    return true;
  }
  connections.set(userId, count);
  return false;
}

function filterOnline(userIds) {
  return Array.isArray(userIds) ? userIds.filter((id) => connections.has(String(id))) : [];
}

module.exports = { add, remove, filterOnline };
