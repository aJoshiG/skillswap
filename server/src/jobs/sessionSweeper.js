const { resolveOverdue } = require('../services/session.service');

/**
 * Runs the session sweeper now and then every `minutes`. It's safe on several instances at once:
 * each resolution is a conditional, transactional update. On hosts that sleep when idle (Render's
 * free tier), the run at startup catches up on anything that became overdue in the meantime.
 */
function startSessionSweeper({ minutes }) {
  let running = false;
  const run = async () => {
    if (running) return; // never overlap with a slow previous run
    running = true;
    try {
      const r = await resolveOverdue(new Date());
      if (r.completed || r.expired || r.proposalsExpired) {
        console.log(
          `Session sweeper: ${r.completed} auto-completed, ${r.expired} expired, ${r.proposalsExpired} stale proposals`,
        );
      }
    } catch (err) {
      console.error('Session sweeper failed:', err.message); // try again next time
    } finally {
      running = false;
    }
  };
  run();
  const timer = setInterval(run, minutes * 60 * 1000);
  return () => clearInterval(timer);
}

module.exports = { startSessionSweeper };
