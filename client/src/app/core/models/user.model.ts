export type SkillLevel = 'beginner' | 'intermediate' | 'expert';
export type Availability = 'online' | 'in-person' | 'both';

export const SKILL_LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'expert'];

export const SKILL_CATEGORIES = [
  'programming',
  'design',
  'music',
  'languages',
  'business',
  'fitness',
  'cooking',
  'arts',
  'academics',
  'other',
] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export interface Skill {
  _id?: string;
  name: string;
  category: SkillCategory;
  level: SkillLevel;
}

export interface PublicUser {
  _id: string;
  name: string;
  bio: string;
  avatarUrl: string;
  location: { city: string; country: string };
  availability: Availability;
  languages: string[];
  skillsOffered: Skill[];
  skillsWanted: Skill[];
  /** Reputation: average = sum / count. */
  reviewStats: ReviewStats;
  lastActiveAt: string;
  createdAt: string;
}

export interface ReviewStats {
  count: number;
  sum: number;
}

/** Average rating, or null when there are no reviews yet. */
export function averageRating(stats: ReviewStats | undefined): number | null {
  return stats && stats.count > 0 ? stats.sum / stats.count : null;
}

/** A public profile page also includes the teaching record (from completed sessions). */
export interface PublicProfile extends PublicUser {
  teaching: { sessions: number; hours: number };
}

export interface User extends PublicUser {
  email: string;
  /** Spendable time credits (private to the user). */
  credits: number;
}

export interface UserPreview {
  _id: string;
  name: string;
  avatarUrl: string;
  location?: { city: string; country: string };
  availability?: Availability;
  lastActiveAt?: string;
}

export type ProfileUpdate = Partial<
  Pick<
    User,
    | 'name'
    | 'bio'
    | 'avatarUrl'
    | 'location'
    | 'availability'
    | 'languages'
    | 'skillsOffered'
    | 'skillsWanted'
  >
>;

export interface ExploreQuery {
  q?: string;
  type?: 'offered' | 'wanted';
  category?: SkillCategory | '';
  level?: SkillLevel | '';
  availability?: 'online' | 'in-person' | '';
  city?: string;
  page?: number;
  limit?: number;
}

/** Why a user was matched with you (computed by the server's aggregation pipeline). */
export interface MatchInfo {
  score: number;
  /** Both directions line up: they teach what you want AND want what you teach. */
  mutual: boolean;
  /** Their skills that you want to learn. */
  theyTeach: Skill[];
  /** Their wanted skills that you can teach. */
  theyWant: Skill[];
  canMeetOnline: boolean;
  canMeetInPerson: boolean;
}

export interface MatchedUser extends PublicUser {
  match: MatchInfo;
  /** The latest pending or accepted swap between you, if any. */
  swap?: { _id: string; status: 'pending' | 'accepted'; from: string };
}
