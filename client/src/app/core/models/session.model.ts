import { Skill } from './user.model';

export type SessionStatus = 'proposed' | 'scheduled' | 'completed' | 'declined' | 'cancelled';
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
  completedAt: string | null;
  cancelledBy: string | null;
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
  action: 'proposed' | 'accepted' | 'declined' | 'cancelled' | 'confirmed' | 'completed';
  by: string;
}

/** 1.5 → "1.5 credits", 1 → "1 credit". */
export function creditLabel(n: number): string {
  const value = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return `${value} ${n === 1 ? 'credit' : 'credits'}`;
}
