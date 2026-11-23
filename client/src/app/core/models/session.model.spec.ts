import { Session, autoResolveAt, creditLabel, sessionEnd } from './session.model';

const session = (overrides: Partial<Session>): Session =>
  ({
    scheduledAt: '2026-11-20T18:00:00.000Z',
    durationMinutes: 90,
    confirmedBy: [],
    ...overrides,
  }) as Session;

describe('session model helpers', () => {
  it('ends a session after its duration', () => {
    expect(sessionEnd(session({})).toISOString()).toBe('2026-11-20T19:30:00.000Z');
  });

  it('auto-completes 72 hours after the end once someone has confirmed', () => {
    const s = session({ confirmedBy: ['someone'] });
    expect(autoResolveAt(s).toISOString()).toBe('2026-11-23T19:30:00.000Z');
  });

  it('expires 7 days after the end when nobody confirmed', () => {
    expect(autoResolveAt(session({})).toISOString()).toBe('2026-11-27T19:30:00.000Z');
  });

  it('labels credit amounts', () => {
    expect(creditLabel(1)).toBe('1 credit');
    expect(creditLabel(1.5)).toBe('1.5 credits');
    expect(creditLabel(2)).toBe('2 credits');
  });
});
