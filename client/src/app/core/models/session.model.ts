import { Skill } from './user.model';

export type SessionStatus =
  'proposed' | 'scheduled' | 'completed' | 'declined' | 'cancelled' | 'expired';

/** Mirrors the server's session sweeper, counted from when a session ends. */
export const AUTO_COMPLETE_AFTER_HOURS = 72;
export const AUTO_EXPIRE_AFTER_DAYS = 7;

/** When a session ends (start + duration). */
export function sessionEnd(s: Pick<Session, 'scheduledAt' | 'durationMinutes'>): Date {
  return new Date(new Date(s.scheduledAt).getTime() + s.durationMinutes * 60_000);
}

/** When the sweeper will resolve a started session: auto-complete if anyone confirmed, else expire. */
export function autoResolveAt(s: Session): Date {
  const hours = s.confirmedBy.length ? AUTO_COMPLETE_AFTER_HOURS : AUTO_EXPIRE_AFTER_DAYS * 24;
  return new Date(sessionEnd(s).getTime() + hours * 3_600_000);
}
export type SessionAction = 'accept' | 'decline' | 'cancel' | 'confirm';
export type SessionScope = 'active' | 'history';
export type SessionMode = 'online' | 'in-person';

export const SESSION_DURATIONS = [30, 60, 90, 120] as const;

export interface SessionUser {
  _id: string;
  name: string;
  avatarUrl: string;
}

export interface Session {
  _id: string;
  request: string;
  teacher: SessionUser;
  learner: SessionUser;
  skill: Omit<Skill, '_id'>;
  scheduledAt: string;
  durationMinutes: number;
  credits: number;
  mode: SessionMode;
  note: string;
  proposedBy: string;
  status: SessionStatus;
  confirmedBy: string[];
  /** When the proposal was accepted or declined (null while still proposed). */
  respondedAt: string | null;
  completedAt: string | null;
  cancelledBy: string | null;
  /** True when the sweeper (not a person) completed or expired it. */
  autoResolved?: boolean;
  createdAt: string;
  /** On completed sessions: my review of the other person, or null if I haven't reviewed yet. */
  myReview?: { rating: number; comment: string } | null;
}

export interface ProposeSession {
  requestId: string;
  /** 'requested': the skill that was asked for in the swap; 'offered': the one offered back. */
  skill: 'requested' | 'offered';
  scheduledAt: string;
  durationMinutes: number;
  mode: SessionMode;
  note?: string;
}

export type CreditType = 'welcome' | 'session-hold' | 'session-refund' | 'session-earned';

export interface CreditEntry {
  _id: string;
  amount: number;
  balanceAfter: number;
  type: CreditType;
  createdAt: string;
  session: {
    _id: string;
    skill: { name: string };
    teacher: { _id: string; name: string };
    learner: { _id: string; name: string };
  } | null;
}

export interface CreditSummary {
  balance: number;
  /** Credits set aside for scheduled sessions where I'm the learner. */
  held: number;
  transactions: CreditEntry[];
}

/** Pushed over the socket to the other participant whenever a session changes. */
export interface SessionEvent {
  session: Session;
  action:
    | 'proposed'
    | 'accepted'
    | 'declined'
    | 'cancelled'
    | 'confirmed'
    | 'completed'
    | 'auto-completed'
    | 'expired';
  by: string;
}

/** 1.5 → "1.5 credits", 1 → "1 credit". */
export function creditLabel(n: number): string {
  const value = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return `${value} ${n === 1 ? 'credit' : 'credits'}`;
}
