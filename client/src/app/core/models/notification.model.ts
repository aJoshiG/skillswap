import { creditLabel } from './session.model';

export type NotificationType =
  | 'request:new'
  | 'request:accepted'
  | 'request:declined'
  | 'session:proposed'
  | 'session:accepted'
  | 'session:declined'
  | 'session:cancelled'
  | 'session:confirmed'
  | 'session:completed'
  | 'session:auto-completed'
  | 'session:expired'
  | 'review:new';

export interface AppNotification {
  _id: string;
  type: NotificationType;
  /** Who did it; null when SkillSwap itself did (e.g. auto-resolving a session). */
  actor: { _id: string; name: string; avatarUrl: string } | null;
  data: { skill?: string; credits?: number; rating?: number };
  /** Client route, possibly with a #fragment. */
  link: string;
  readAt: string | null;
  createdAt: string;
}

/** Icon and sentence for a notification, e.g. "🤝 Riya accepted your Guitar request". */
export function describeNotification(n: AppNotification): { icon: string; text: string } {
  const who = n.actor?.name.split(' ')[0] ?? 'SkillSwap';
  const skill = n.data.skill ?? 'a';
  const credits = n.data.credits !== undefined ? creditLabel(n.data.credits) : '';
  switch (n.type) {
    case 'request:new':
      return { icon: '📩', text: `${who} wants to learn ${skill} from you` };
    case 'request:accepted':
      return { icon: '🤝', text: `${who} accepted your ${skill} request. Say hi!` };
    case 'request:declined':
      return { icon: '🙅', text: `${who} declined your ${skill} request` };
    case 'session:proposed':
      return { icon: '📅', text: `${who} proposed a ${skill} session` };
    case 'session:accepted':
      return { icon: '✅', text: `${who} accepted the ${skill} session` };
    case 'session:declined':
      return { icon: '🙅', text: `${who} declined the ${skill} session` };
    case 'session:cancelled':
      return { icon: '🚫', text: `${who} cancelled the ${skill} session` };
    case 'session:confirmed':
      return {
        icon: '👍',
        text: `${who} confirmed the ${skill} session happened. Confirm it too.`,
      };
    case 'session:completed':
      return { icon: '🎉', text: `${skill} session with ${who} completed` };
    case 'session:auto-completed':
      return { icon: '🎉', text: `${skill} session completed automatically (${credits})` };
    case 'session:expired':
      return { icon: '⌛', text: `${skill} session expired without confirmation` };
    case 'review:new':
      return { icon: '⭐', text: `${who} left you a ${n.data.rating}★ review for ${skill}` };
  }
}

/** Splits "/users/1#reviews" into a router path and fragment. */
export function splitLink(link: string): { path: string; fragment?: string } {
  const [path, fragment] = link.split('#');
  return fragment ? { path, fragment } : { path };
}
