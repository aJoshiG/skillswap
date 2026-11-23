import { Skill, UserPreview } from './user.model';

export type RequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';
export type RequestAction = 'accept' | 'decline' | 'cancel';
export type RequestBox = 'received' | 'sent';

export interface SwapRequest {
  _id: string;
  from: UserPreview;
  to: UserPreview;
  skill: Omit<Skill, '_id'>;
  offeredSkill: Omit<Skill, '_id'> | null;
  message: string;
  status: RequestStatus;
  respondedAt: string | null;
  createdAt: string;
  /** Set on accepted requests in list responses. */
  conversationId?: string | null;
}

export interface CreateRequest {
  to: string;
  skillId: string;
  offeredSkillId?: string;
  message?: string;
}

export interface RespondResult {
  request: SwapRequest;
  conversationId: string | null;
}
