import { TimeAgoPipe } from './time-ago.pipe';

describe('TimeAgoPipe', () => {
  const pipe = new TimeAgoPipe();
  const ago = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString();

  it('returns an empty string for missing values', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });

  it('formats recent times as "just now"', () => {
    expect(pipe.transform(ago(10))).toBe('just now');
  });

  it('uses the largest fitting unit', () => {
    expect(pipe.transform(ago(5 * 60))).toBe('5 minutes ago');
    expect(pipe.transform(ago(3 * 3600))).toBe('3 hours ago');
    expect(pipe.transform(ago(86_400))).toBe('yesterday');
  });
});
