import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageMeta, errorMessage } from '../../core/models/api.model';
import { MatchedUser } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { SocketService } from '../../core/services/socket.service';
import { ToastService } from '../../core/services/toast.service';
import { UserService } from '../../core/services/user.service';
import { Avatar } from '../../shared/components/avatar';
import { EmptyState } from '../../shared/components/empty-state';
import { SkillChip } from '../../shared/components/skill-chip';

type Kind = 'mutual' | 'teach-you' | 'learn-from-you';

@Component({
  selector: 'app-matches',
  imports: [RouterLink, Avatar, SkillChip, EmptyState],
  template: `
    <div class="page">
      <header class="mb-6">
        <h1 class="text-3xl font-bold">Your best matches</h1>
        <p class="mt-1 text-slate-500">
          People whose skills line up with yours, best fit first. Two-way swaps come first: you each
          teach the other something.
        </p>
      </header>

      @if (!hasSkills()) {
        <app-empty-state
          icon="🧩"
          title="Add your skills to get matches"
          message="Tell us what you can teach and what you want to learn, and we'll find people who fit."
        >
          <a routerLink="/profile/edit" class="btn-primary">Add skills</a>
        </app-empty-state>
      } @else if (loading() && !matches().length) {
        <div class="grid gap-4 md:grid-cols-2">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="card space-y-3 p-5">
              <div class="flex items-center gap-3">
                <div class="skeleton size-12 rounded-full"></div>
                <div class="skeleton h-4 w-40"></div>
              </div>
              <div class="skeleton h-3 w-3/4"></div>
              <div class="skeleton h-3 w-1/2"></div>
            </div>
          }
        </div>
      } @else if (!matches().length) {
        <app-empty-state
          icon="🔭"
          title="No matches yet"
          message="Nobody teaches what you want or wants what you teach right now. Try adding a few more skills, or browse everyone."
        >
          <div class="flex flex-wrap justify-center gap-2">
            <a routerLink="/profile/edit" class="btn-secondary">Edit skills</a>
            <a routerLink="/explore" class="btn-primary">Explore everyone</a>
          </div>
        </app-empty-state>
      } @else {
        <p class="mb-3 text-sm text-slate-500">
          {{ meta()?.total }} {{ meta()?.total === 1 ? 'match' : 'matches' }}
          @if (mutualCount(); as n) {
            · <span class="font-medium text-emerald-700">{{ n }} two-way</span> on this page
          }
        </p>
        <ol class="grid gap-4 md:grid-cols-2" [class.opacity-60]="loading()">
          @for (m of matches(); track m._id) {
            <li>
              <a
                [routerLink]="['/users', m._id]"
                class="card group flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-md"
                [class.ring-2]="m.match.mutual"
                [class.ring-emerald-200]="m.match.mutual"
              >
                <div class="flex items-start gap-3">
                  <app-avatar
                    [src]="m.avatarUrl"
                    [name]="m.name"
                    [online]="socket.isOnline(m._id)"
                  />
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="truncate font-semibold group-hover:text-brand-700">{{ m.name }}</p>
                      <span
                        class="rounded-full px-2 py-0.5 text-xs font-semibold"
                        [class]="badge(m).cls"
                      >
                        {{ badge(m).label }}
                      </span>
                    </div>
                    <p class="truncate text-xs text-slate-500">
                      {{ m.location.city || 'Anywhere' }}
                      @if (m.swap; as swap) {
                        ·
                        <span class="font-medium text-brand-700">
                          {{
                            swap.status === 'accepted'
                              ? 'Swapping now'
                              : swap.from === myId()
                                ? 'Request sent'
                                : 'Sent you a request'
                          }}
                        </span>
                      }
                    </p>
                  </div>
                </div>

                <dl class="mt-4 space-y-3 text-sm">
                  @if (m.match.theyTeach.length) {
                    <div>
                      <dt
                        class="mb-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase"
                      >
                        Can teach you
                      </dt>
                      <dd class="flex flex-wrap gap-1.5">
                        @for (s of m.match.theyTeach; track s._id) {
                          <app-skill-chip [skill]="s" variant="offer" />
                        }
                      </dd>
                    </div>
                  }
                  @if (m.match.theyWant.length) {
                    <div>
                      <dt
                        class="mb-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase"
                      >
                        Wants to learn from you
                      </dt>
                      <dd class="flex flex-wrap gap-1.5">
                        @for (s of m.match.theyWant; track s._id) {
                          <app-skill-chip [skill]="s" variant="want" [showLevel]="false" />
                        }
                      </dd>
                    </div>
                  }
                </dl>

                <ul class="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-4 text-xs text-slate-500">
                  @for (reason of reasons(m); track reason) {
                    <li>{{ reason }}</li>
                  }
                </ul>
              </a>
            </li>
          }
        </ol>

        @if (meta(); as pm) {
          @if (pm.totalPages > 1) {
            <nav class="mt-8 flex items-center justify-center gap-3" aria-label="Pagination">
              <button
                class="btn-secondary"
                [disabled]="pm.page <= 1 || loading()"
                (click)="load(pm.page - 1)"
              >
                ← Previous
              </button>
              <span class="text-sm text-slate-500">Page {{ pm.page }} of {{ pm.totalPages }}</span>
              <button
                class="btn-secondary"
                [disabled]="pm.page >= pm.totalPages || loading()"
                (click)="load(pm.page + 1)"
              >
                Next →
              </button>
            </nav>
          }
        }
      }
    </div>
  `,
})
export class Matches {
  private readonly users = inject(UserService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  protected readonly socket = inject(SocketService);

  protected readonly matches = signal<MatchedUser[]>([]);
  protected readonly meta = signal<PageMeta | null>(null);
  protected readonly loading = signal(true);

  protected readonly myId = computed(() => this.auth.user()?._id);
  protected readonly hasSkills = computed(() => {
    const me = this.auth.user();
    return !!me && (me.skillsOffered.length > 0 || me.skillsWanted.length > 0);
  });
  protected readonly mutualCount = computed(
    () => this.matches().filter((m) => m.match.mutual).length,
  );

  constructor() {
    if (this.hasSkills()) this.load(1);
  }

  protected load(page: number) {
    this.loading.set(true);
    this.users.matches(page).subscribe({
      next: (res) => {
        this.matches.set(res.items);
        this.meta.set(res.meta);
        this.loading.set(false);
        this.socket.queryPresence(res.items.map((m) => m._id));
        if (page > 1) window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected kind(m: MatchedUser): Kind {
    if (m.match.mutual) return 'mutual';
    return m.match.theyTeach.length ? 'teach-you' : 'learn-from-you';
  }

  protected badge(m: MatchedUser) {
    switch (this.kind(m)) {
      case 'mutual':
        return { label: '⇄ Two-way swap', cls: 'bg-emerald-100 text-emerald-800' };
      case 'teach-you':
        return { label: 'Can teach you', cls: 'bg-brand-50 text-brand-700' };
      default:
        return { label: 'Wants to learn from you', cls: 'bg-amber-100 text-amber-800' };
    }
  }

  /** Short, human reasons behind the ranking. */
  protected reasons(m: MatchedUser): string[] {
    const out: string[] = [];
    const overlap = m.match.theyTeach.length + m.match.theyWant.length;
    if (overlap > 1) out.push(`🧩 ${overlap} skills line up`);
    if (m.match.theyTeach.some((s) => s.level === 'expert')) out.push('🎓 Expert teacher');
    if (m.match.canMeetInPerson) out.push(`📍 Also in ${m.location.city}, can meet in person`);
    else if (m.match.canMeetOnline) out.push('💻 You both swap online');
    if (!m.match.canMeetInPerson && !m.match.canMeetOnline) out.push('⚠️ Meeting formats differ');
    return out;
  }
}
