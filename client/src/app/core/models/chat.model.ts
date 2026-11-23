import { Skill, UserPreview } from './user.model';
import { RequestStatus } from './request.model';

export interface LastMessage {
  text: string;
  sender: string | null;
  createdAt: string | null;
}

export interface Conversation {
  _id: string;
  participants: UserPreview[];
  otherUser: UserPreview | null;
  request: {
    _id: string;
    skill: Omit<Skill, '_id'>;
    offeredSkill: Omit<Skill, '_id'> | null;
    status: RequestStatus;
    from: string;
    to: string;
  };
  lastMessage: LastMessage;
  unreadCount?: number;
  updatedAt: string;
}

export interface Message {
  _id: string;
  conversation: string;
  sender: string;
  text: string;
  readAt: string | null;
  createdAt: string;
  /** Client-only: optimistic message waiting for the server's acknowledgement. */
  pending?: boolean;
}
