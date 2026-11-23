import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PageMeta, errorMessage } from '../../core/models/api.model';
import { Review } from '../../core/models/review.model';
import { PublicProfile, Skill, averageRating } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { SocketService } from '../../core/services/socket.service';
import { UserService } from '../../core/services/user.service';
import { Avatar } from '../../shared/components/avatar';
import { EmptyState } from '../../shared/components/empty-state';
import { SkillChip } from '../../shared/components/skill-chip';
import { Stars } from '../../shared/components/stars';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { RequestModal } from './request-modal';

const sameSkill = (a: Pick<Skill, 'name'>, b: Pick<Skill, 'name'>) =>
  a.name.trim().toLowerCase() === b.name.trim().toLowerCase();

@Component({
  selector: 'app-profile-view',
  imports: [RouterLink, DatePipe, Avatar, SkillChip, EmptyState, TimeAgoPipe, RequestModal, Stars],
  template: `
    <div class="page max-w-4xl">
      @if (loading()) {
        <div class="card p-8">
          <div class="flex items-center gap-5">
            <div class="skeleton size-24 rounded-full"></div>
            <div class="flex-1 space-y-3">
              <div class="skeleton h-6 w-48"></div>
              <div class="skeleton h-4 w-32"></div>
            </div>
          </div>
        </div>
      } @else if (error()) {
        <app-empty-state icon="🙈" title="Profile not found" [message]="error()">
          <a routerLink="/explore" class="btn-secondary">Back to Explore</a>
        </app-empty-state>
      } @else if (user(); as u) {
        <section class="card overflow-hidden">
          <div class="h-24 bg-gradient-to-r from-brand-500 to-brand-700"></div>
          <div class="px-6 pb-6 sm:px-8">
            <div class="-mt-12 flex flex-wrap items-end justify-between gap-4">
              <app-avatar
                [src]="u.avatarUrl"
                [name]="u.name"
                size="xl"
                [online]="socket.isOnline(u._id)"
              />
              @if (isMe()) {
                <a routerLink="/profile/edit" class="btn-secondary">Edit profile</a>
              }
            </div>
            <h1 class="mt-4 text-2xl font-bold">{{ u.name }}</h1>
            <p class="mt-1 text-sm text-slate-500">
              📍
              {{
                u.location.city
                  ? u.location.city + (u.location.country ? ', ' + u.location.country : '')
                  : 'Location not set'
              }}
              ·
              {{
                u.availability === 'both'
                  ? 'Online & in person'
                  : u.availability === 'online'
                    ? 'Online'
                    : 'In person'
              }}
              · {{ socket.isOnline(u._id) ? 'Online now' : 'Active ' + (u.lastActiveAt | timeAgo) }}
            </p>
            <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              @if (rating(); as r) {
                <a href="#reviews" class="hover:underline">
                  <app-stars [value]="r" [count]="u.reviewStats.count" size="md" />
                </a>
              } @else {
                <span class="text-slate-500">No reviews yet</span>
              }
              @if (u.teaching.sessions) {
                <span class="text-slate-600">
                  🎓 {{ u.teaching.sessions }} session{{
                    u.teaching.sessions === 1 ? '' : 's'
                  }}
                  taught · {{ u.teaching.hours }} h
                </span>
              }
            </div>
            @if (u.bio) {
              <p class="mt-4 whitespace-pre-line text-slate-700">{{ u.bio }}</p>
            }
            @if (u.languages.length) {
              <p class="mt-4 text-sm text-slate-500">🗣️ Speaks {{ u.languages.join(', ') }}</p>
            }
            <p class="mt-2 text-xs text-slate-500">
              Member since {{ u.createdAt | date: 'MMMM y' }}
            </p>
          </div>
        </section>

        <div class="mt-6 grid gap-6 md:grid-cols-2">
          <section class="card p-6">
            <h2 class="text-lg font-semibold">Can teach</h2>
            <ul class="mt-4 space-y-3">
              @for (skill of u.skillsOffered; track skill._id) {
                <li class="flex items-center justify-between gap-3">
                  <div class="flex flex-wrap items-center gap-2">
                    <app-skill-chip [skill]="skill" />
                    @if (!isMe() && iWant(skill)) {
                      <span class="text-xs font-medium text-emerald-700">★ You want this</span>
                    }
                  </div>
                  @if (!isMe()) {
                    <button class="btn-primary btn-sm" (click)="requestSkill.set(skill)">
                      Request
                    </button>
                  }
                </li>
              } @empty {
                <li class="text-sm text-slate-500">No skills listed yet.</li>
              }
            </ul>
          </section>

          <section class="card p-6">
            <h2 class="text-lg font-semibold">Wants to learn</h2>
            <ul class="mt-4 flex flex-wrap gap-2">
              @for (skill of u.skillsWanted; track skill._id) {
                <li class="flex items-center gap-2">
                  <app-skill-chip [skill]="skill" variant="want" />
                  @if (!isMe() && iTeach(skill)) {
                    <span class="text-xs font-medium text-emerald-700">★ You teach this</span>
                  }
                </li>
              } @empty {
                <li class="text-sm text-slate-500">Nothing listed yet.</li>
              }
            </ul>
          </section>
        </div>

        <section id="reviews" class="card mt-6 scroll-mt-24 p-6">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <h2 class="text-lg font-semibold">Reviews</h2>
            @if (rating(); as r) {
              <app-stars [value]="r" [count]="u.reviewStats.count" />
            }
          </div>
          <ul class="mt-4 divide-y divide-slate-100">
            @for (r of reviews(); track r._id) {
              <li class="py-4 first:pt-0 last:pb-0">
                <div class="flex items-start gap-3">
                  <a [routerLink]="['/users', r.reviewer._id]">
                    <app-avatar [src]="r.reviewer.avatarUrl" [name]="r.reviewer.name" size="sm" />
                  </a>
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <a
                        [routerLink]="['/users', r.reviewer._id]"
                        class="font-medium hover:underline"
                        >{{ r.reviewer.name }}</a
                      >
                      <app-stars [value]="r.rating" [showValue]="false" />
                      <span class="text-xs text-slate-500">{{ r.createdAt | timeAgo }}</span>
                    </div>
                    <p class="text-xs text-slate-500">
                      {{ r.role === 'teacher' ? 'Learned' : 'Taught' }} {{ r.skill.name }}
                      {{ r.role === 'teacher' ? 'from' : 'to' }} {{ u.name.split(' ')[0] }}
                    </p>
                    @if (r.comment) {
                      <p class="mt-1.5 text-sm whitespace-pre-line text-slate-700">
                        {{ r.comment }}
                      </p>
                    }
                  </div>
                </div>
              </li>
            } @empty {
              <li class="text-sm text-slate-500">
                {{
                  isMe()
                    ? 'Reviews from your completed sessions will appear here.'
                    : 'No reviews yet.'
                }}
              </li>
            }
          </ul>
          @if (reviewsMeta(); as m) {
            @if (m.page < m.totalPages) {
              <button
                class="btn-ghost btn-sm mt-3"
                [disabled]="loadingReviews()"
                (click)="moreReviews()"
              >
                Show more reviews
              </button>
            }
          }
        </section>

        @if (requestSkill(); as skill) {
          <app-request-modal
            [recipient]="u"
            [skill]="skill"
            (closed)="requestSkill.set(null)"
            (sent)="requestSkill.set(null)"
          />
        }
      }
    </div>
  `,
})
export class ProfileView {
  private readonly users = inject(UserService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  protected readonly socket = inject(SocketService);

  /** Route param :id (bound via withComponentInputBinding). */
  readonly id = input.required<string>();

  protected readonly user = signal<PublicProfile | null>(null);
  protected readonly rating = computed(() => averageRating(this.user()?.reviewStats));
  protected readonly reviews = signal<Review[]>([]);
  protected readonly reviewsMeta = signal<PageMeta | null>(null);
  protected readonly loadingReviews = signal(false);

  private loadReviews(id: string, page: number) {
    this.loadingReviews.set(true);
    this.users.reviews(id, page).subscribe({
      next: (res) => {
        this.reviews.update((list) => (page === 1 ? res.items : [...list, ...res.items]));
        this.reviewsMeta.set(res.meta);
        // Links like /users/:id#reviews (from a review notification): scroll once the list exists.
        if (page === 1 && this.route.snapshot.fragment === 'reviews') {
          setTimeout(() =>
            document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth' }),
          );
        }
        this.loadingReviews.set(false);
      },
      error: () => this.loadingReviews.set(false),
    });
  }

  protected moreReviews() {
    const meta = this.reviewsMeta();
    if (meta) this.loadReviews(this.id(), meta.page + 1);
  }
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly requestSkill = signal<Skill | null>(null);
  protected readonly isMe = computed(() => this.auth.user()?._id === this.id());

  constructor() {
    // Reload whenever the route id changes (e.g. clicking another profile link).
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  private load(id: string) {
    this.loading.set(true);
    this.error.set('');
    this.reviews.set([]);
    this.reviewsMeta.set(null);
    this.users.getById(id).subscribe({
      next: (user) => {
        this.user.set(user);
        this.loading.set(false);
        this.socket.queryPresence([user._id]);
        this.loadReviews(id, 1);
      },
      error: (err) => {
        this.error.set(errorMessage(err, 'This profile could not be loaded.'));
        this.loading.set(false);
      },
    });
  }

  protected iWant(skill: Skill) {
    return this.auth.user()?.skillsWanted.some((s) => sameSkill(s, skill)) ?? false;
  }

  protected iTeach(skill: Skill) {
    return this.auth.user()?.skillsOffered.some((s) => sameSkill(s, skill)) ?? false;
  }
}
