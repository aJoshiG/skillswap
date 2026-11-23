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
  lastActiveAt: string;
  createdAt: string;
}

export interface User extends PublicUser {
  email: string;
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
