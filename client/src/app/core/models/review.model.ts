export interface Review {
  _id: string;
  session: string;
  reviewer: { _id: string; name: string; avatarUrl: string };
  reviewee: string;
  /** The reviewee's role in that session. */
  role: 'teacher' | 'learner';
  skill: { name: string };
  rating: number;
  comment: string;
  createdAt: string;
}

export interface NewReview {
  rating: number;
  comment?: string;
}
