import {
  AppNotification,
  NotificationType,
  describeNotification,
  splitLink,
} from './notification.model';

const make = (type: NotificationType, actor = true): AppNotification => ({
  _id: '1',
  type,
  actor: actor ? { _id: 'u1', name: 'Riya Sharma', avatarUrl: '' } : null,
  data: { skill: 'Guitar', credits: 1.5, rating: 4 },
  link: '/sessions',
  readAt: null,
  createdAt: new Date().toISOString(),
});

describe('notification model', () => {
  it('describes every notification type with an icon and a sentence', () => {
    const types: NotificationType[] = [
      'request:new',
      'request:accepted',
      'request:declined',
      'session:proposed',
      'session:accepted',
      'session:declined',
      'session:cancelled',
      'session:confirmed',
      'session:completed',
      'session:auto-completed',
      'session:expired',
      'review:new',
    ];
    for (const t of types) {
      const { icon, text } = describeNotification(make(t));
      expect(icon).withContext(t).toBeTruthy();
      expect(text).withContext(t).toContain('Guitar');
      expect(text).withContext(t).not.toContain('undefined');
    }
  });

  it('uses first names, and "SkillSwap" style text for system events', () => {
    expect(describeNotification(make('request:accepted')).text).toBe(
      'Riya accepted your Guitar request. Say hi!',
    );
    expect(describeNotification(make('review:new')).text).toBe(
      'Riya left you a 4★ review for Guitar',
    );
    expect(describeNotification(make('session:auto-completed', false)).text).toBe(
      'Guitar session completed automatically (1.5 credits)',
    );
  });

  it('splits links into a route and a fragment', () => {
    expect(splitLink('/users/42#reviews')).toEqual({ path: '/users/42', fragment: 'reviews' });
    expect(splitLink('/sessions')).toEqual({ path: '/sessions' });
  });
});
