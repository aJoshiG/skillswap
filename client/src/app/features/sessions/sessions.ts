import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorMessage } from '../../core/models/api.model';
import {
  CreditEntry,
  autoResolveAt,
  CreditSummary,
  Session,
  SessionAction,
  SessionScope,
  creditLabel,
} from '../../core/models/session.model';
import { AuthService } from '../../core/services/auth.service';
import { SessionService } from '../../core/services/session.service';
import { ToastService } from '../../core/services/toast.service';
import { Avatar } from '../../shared/components/avatar';
import { EmptyState } from '../../shared/components/empty-state';
import { Stars } from '../../shared/components/stars';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { ReviewModal } from './review-modal';

@Component({
  selector: 'app-sessions',
  imports: [DatePipe, RouterLink, Avatar, EmptyState, TimeAgoPipe, Stars, ReviewModal],
  template: `
    <div class="page">
      <header class="mb-6">
        <h1 class="text-3xl font-bold">Sessions</h1>
        <p class="mt-1 text-slate-500">
          Teach for an hour, earn a credit. Spend credits to learn from others.
        </p>
      </header>

      <div class="grid gap-6 lg:grid-cols-3">
        <!-- Sessions -->
        <section class="lg:col-span-2" aria-label="Your sessions">
          <div class="mb-4 inline-flex rounded-lg bg-slate-100 p-1" role="tablist">
            @for (tab of tabs; track tab.value) {
              <button
                role="tab"
                class="rounded-md px-4 py-1.5 text-sm font-medium transition"
                [class]="
                  scope() === tab.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                "
                [attr.aria-selected]="scope() === tab.value"
                (click)="scope.set(tab.value)"
              >
                {{ tab.label }}
                @if (tab.value === 'active' && sessionsApi.needsAction()) {
                  <span class="ml-1 rounded-full bg-brand-600 px-1.5 text-[10px] text-white">{{
                    sessionsApi.needsAction()
                  }}</span>
                }
              </button>
            }
          </div>

          @if (loading() && !items().length) {
            <div class="space-y-3">
              @for (i of [1, 2, 3]; track i) {
                <div class="card flex gap-4 p-5">
                  <div class="skeleton h-16 w-14 rounded-lg"></div>
                  <div class="flex-1 space-y-2">
                    <div class="skeleton h-4 w-1/2"></div>
                    <div class="skeleton h-3 w-1/3"></div>
                  </div>
                </div>
              }
            </div>
          } @else if (!items().length) {
            @if (scope() === 'active') {
              <app-empty-state
                icon="📅"
                title="No upcoming sessions"
                message="Once a swap is accepted, schedule a session from the chat or the Requests page."
              >
                <div class="flex flex-wrap justify-center gap-2">
                  <a routerLink="/requests" class="btn-secondary">Your swaps</a>
                  <a routerLink="/matches" class="btn-primary">Find a match</a>
                </div>
              </app-empty-state>
            } @else {
              <app-empty-state
                icon="🗂️"
                title="No past sessions yet"
                message="Completed and cancelled sessions show up here."
              />
            }
          } @else {
            <ul class="space-y-3" [class.opacity-60]="loading()">
              @for (s of items(); track s._id) {
                <li
                  class="card p-5"
                  [class.ring-2]="!!sessionsApi.myAction(s)"
                  [class.ring-brand-200]="!!sessionsApi.myAction(s)"
                >
                  <div class="flex gap-4">
                    <div class="w-14 shrink-0 rounded-lg bg-slate-50 py-2 text-center">
                      <p class="text-[11px] font-semibold text-brand-600 uppercase">
                        {{ s.scheduledAt | date: 'MMM' }}
                      </p>
                      <p class="text-xl leading-6 font-bold">{{ s.scheduledAt | date: 'd' }}</p>
                      <p class="text-[11px] text-slate-500">{{ s.scheduledAt | date: 'EEE' }}</p>
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <app-avatar [src]="other(s).avatarUrl" [name]="other(s).name" size="sm" />
                        <p class="font-semibold">{{ title(s) }}</p>
                        <span
                          class="rounded-full px-2 py-0.5 text-xs font-medium"
                          [class]="statusStyle(s)"
                          >{{ statusLabel(s) }}</span
                        >
                      </div>
                      <p class="mt-1 text-sm text-slate-500">
                        {{ s.scheduledAt | date: 'shortTime' }} ·
                        {{ duration(s.durationMinutes) }} ·
                        {{ s.mode === 'online' ? '💻 Online' : '📍 In person' }} ·
                        <span [class]="creditStyle(s)">{{ creditText(s) }}</span>
                      </p>
                      @if (s.note) {
                        <p class="mt-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm text-slate-600">
                          {{ s.note }}
                        </p>
                      }

                      <div class="mt-3 flex flex-wrap items-center gap-2">
                        @switch (state(s)) {
                          @case ('answer') {
                            <button
                              class="btn-primary btn-sm"
                              [disabled]="busy() === s._id"
                              (click)="act(s, 'accept')"
                            >
                              Accept
                            </button>
                            <button
                              class="btn-danger btn-sm"
                              [disabled]="busy() === s._id"
                              (click)="act(s, 'decline')"
                            >
                              Decline
                            </button>
                            @if (iAmLearner(s)) {
                              <span class="text-xs text-slate-500"
                                >Accepting holds {{ label(s.credits) }} from your balance.</span
                              >
                            }
                          }
                          @case ('waiting-accept') {
                            <span class="text-sm text-slate-500"
                              >Waiting for {{ firstName(other(s).name) }} to accept</span
                            >
                            <button
                              class="btn-ghost btn-sm"
                              [disabled]="busy() === s._id"
                              (click)="act(s, 'cancel')"
                            >
                              Withdraw
                            </button>
                          }
                          @case ('upcoming') {
                            <span class="text-sm text-slate-500"
                              >Starts {{ s.scheduledAt | timeAgo }}</span
                            >
                            <button
                              class="btn-ghost btn-sm"
                              [disabled]="busy() === s._id"
                              (click)="act(s, 'cancel')"
                            >
                              Cancel{{ iAmLearner(s) ? ' (refund)' : '' }}
                            </button>
                          }
                          @case ('confirm') {
                            <span class="text-sm font-medium text-slate-700">{{
                              confirmPrompt(s)
                            }}</span>
                            <button
                              class="btn-primary btn-sm"
                              [disabled]="busy() === s._id"
                              (click)="act(s, 'confirm')"
                            >
                              ✓ Confirm session
                            </button>
                          }
                          @case ('waiting-confirm') {
                            <span class="text-sm text-slate-500">
                              You confirmed · waiting for {{ firstName(other(s).name) }} · completes
                              automatically {{ resolveAt(s) | date: 'EEE d MMM' }}
                            </span>
                          }
                        }
                        @if (s.status === 'completed') {
                          @if (s.myReview; as r) {
                            <span class="flex items-center gap-1.5 text-sm text-slate-500">
                              You rated <app-stars [value]="r.rating" [showValue]="false" />
                            </span>
                          } @else {
                            <button class="btn-secondary btn-sm" (click)="reviewing.set(s)">
                              ★ Review {{ firstName(other(s).name) }}
                            </button>
                          }
                        }
                      </div>
                    </div>
                  </div>
                </li>
              }
            </ul>
          }
        </section>

        <!-- Credits -->
        <aside class="space-y-4" aria-label="Your credits">
          <div class="card bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white">
            <p class="text-sm text-brand-100">Your balance</p>
            <p class="mt-1 font-display text-4xl font-extrabold">
              {{ summary()?.balance ?? '–' }}
              <span class="text-lg font-semibold text-brand-100">{{
                summary()?.balance === 1 ? 'credit' : 'credits'
              }}</span>
            </p>
            @if (summary()?.held) {
              <p class="mt-1 text-sm text-brand-100">
                + {{ label(summary()!.held) }} held for upcoming sessions
              </p>
            }
            <p class="mt-3 border-t border-white/20 pt-3 text-xs text-brand-100">
              1 hour of teaching = 1 credit. Held credits are refunded if a session is cancelled
              before it starts.
            </p>
          </div>

          <div class="card p-5">
            <h2 class="mb-3 font-semibold">Recent activity</h2>
            @if (summary(); as sum) {
              <ul class="space-y-3">
                @for (t of sum.transactions; track t._id) {
                  <li class="flex items-start justify-between gap-3 text-sm">
                    <div class="min-w-0">
                      <p class="truncate text-slate-700">{{ ledgerText(t) }}</p>
                      <p class="text-xs text-slate-500">{{ t.createdAt | timeAgo }}</p>
                    </div>
                    <span
                      class="shrink-0 font-semibold"
                      [class]="t.amount >= 0 ? 'text-emerald-700' : 'text-slate-500'"
                    >
                      {{ t.amount > 0 ? '+' : '' }}{{ t.amount }}
                    </span>
                  </li>
                } @empty {
                  <li class="text-sm text-slate-500">No activity yet.</li>
                }
              </ul>
            } @else {
              <div class="space-y-2">
                <div class="skeleton h-4 w-full"></div>
                <div class="skeleton h-4 w-2/3"></div>
              </div>
            }
          </div>
        </aside>
      </div>
    </div>

    @if (reviewing(); as s) {
      <app-review-modal
        [session]="s"
        (closed)="reviewing.set(null)"
        (reviewed)="reviewing.set(null); load(scope())"
      />
    }
  `,
})
export class Sessions {
  /** The completed session being reviewed, while the review dialog is open. */
  protected readonly reviewing = signal<Session | null>(null);
  protected readonly sessionsApi = inject(SessionService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly tabs: { value: SessionScope; label: string }[] = [
    { value: 'active', label: 'Upcoming' },
    { value: 'history', label: 'History' },
  ];
  protected readonly scope = signal<SessionScope>('active');
  protected readonly items = signal<Session[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal<string | null>(null);
  protected readonly summary = signal<CreditSummary | null>(null);
  private readonly me = computed(() => this.auth.user()?._id);

  constructor() {
    // Reload when the tab changes or a session changes in realtime.
    effect(() => {
      const scope = this.scope();
      this.sessionsApi.changed();
      untracked(() => this.load(scope));
    });
  }

  protected load(scope: SessionScope) {
    this.loading.set(true);
    this.sessionsApi.list(scope).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(errorMessage(err));
      },
    });
    this.sessionsApi
      .credits(10)
      .subscribe({ next: (c) => this.summary.set(c), error: () => undefined });
  }

  protected act(s: Session, action: SessionAction) {
    this.busy.set(s._id);
    this.sessionsApi.respond(s._id, action).subscribe({
      next: (updated) => {
        this.busy.set(null);
        this.toast.success(this.successText(updated, action));
        this.load(this.scope());
      },
      error: (err) => {
        this.busy.set(null);
        this.toast.error(errorMessage(err));
        this.load(this.scope());
      },
    });
  }

  protected iAmLearner = (s: Session) => s.learner._id === this.me();
  protected other = (s: Session) => (this.iAmLearner(s) ? s.teacher : s.learner);
  protected firstName = (name: string) => name.split(' ')[0];
  protected label = creditLabel;

  protected title(s: Session): string {
    const name = this.firstName(this.other(s).name);
    return this.iAmLearner(s)
      ? `${name} teaches you ${s.skill.name}`
      : `You teach ${name} ${s.skill.name}`;
  }

  protected state(s: Session) {
    const action = this.sessionsApi.myAction(s);
    if (action) return action;
    if (s.status === 'proposed') return 'waiting-accept';
    if (s.status === 'scheduled') {
      return new Date(s.scheduledAt).getTime() > Date.now() ? 'upcoming' : 'waiting-confirm';
    }
    return null;
  }

  protected statusLabel(s: Session): string {
    if (s.status === 'scheduled' && new Date(s.scheduledAt).getTime() <= Date.now())
      return 'To confirm';
    return {
      proposed: 'Proposed',
      scheduled: 'Scheduled',
      completed: 'Completed',
      declined: 'Declined',
      cancelled: 'Cancelled',
      expired: 'Expired',
    }[s.status];
  }

  protected statusStyle(s: Session): string {
    switch (s.status) {
      case 'proposed':
        return 'bg-amber-100 text-amber-800';
      case 'scheduled':
        return 'bg-brand-50 text-brand-700';
      case 'completed':
        return 'bg-emerald-100 text-emerald-800';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  }

  protected creditText(s: Session): string {
    const amount = this.label(s.credits);
    if (s.status === 'completed')
      return this.iAmLearner(s) ? `${amount} spent` : `+${amount} earned`;
    if (s.status === 'expired') {
      return s.confirmedBy.length || !s.respondedAt ? amount : `${amount} refunded`;
    }
    if (s.status === 'declined' || s.status === 'cancelled') return amount;
    return this.iAmLearner(s) ? `costs you ${amount}` : `you earn ${amount}`;
  }

  protected creditStyle(s: Session): string {
    if (s.status === 'completed' && !this.iAmLearner(s)) return 'font-medium text-emerald-700';
    if (s.status === 'declined' || s.status === 'cancelled' || s.status === 'expired')
      return 'line-through';
    return '';
  }

  /** "Did it happen?", plus the auto-resolution deadline so nobody is surprised. */
  protected confirmPrompt(s: Session): string {
    const when = new Date(autoResolveAt(s)).toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    const name = this.firstName(this.other(s).name);
    return s.confirmedBy.length
      ? `${name} confirmed it happened. Confirm too, or it completes automatically ${when}.`
      : `Did it happen? Confirm by ${when}, or it expires and the credits are refunded.`;
  }

  protected resolveAt = autoResolveAt;

  protected duration(minutes: number): string {
    return minutes < 60 ? `${minutes} min` : `${minutes / 60} h`;
  }

  protected ledgerText(t: CreditEntry): string {
    const s = t.session;
    const other = s ? (s.learner._id === this.me() ? s.teacher.name : s.learner.name) : '';
    switch (t.type) {
      case 'welcome':
        return 'Welcome credits';
      case 'session-hold':
        return `Held for ${s?.skill.name} with ${other}`;
      case 'session-refund':
        return `Refund: ${s?.skill.name} with ${other}`;
      default:
        return `Taught ${s?.skill.name} to ${other}`;
    }
  }

  private successText(s: Session, action: SessionAction): string {
    switch (action) {
      case 'accept':
        return this.iAmLearner(s) ? `Scheduled! ${this.label(s.credits)} held.` : 'Scheduled!';
      case 'decline':
        return 'Proposal declined';
      case 'cancel':
        return s.status === 'cancelled' && this.iAmLearner(s)
          ? 'Cancelled. Credits refunded.'
          : 'Cancelled';
      default:
        return s.status === 'completed'
          ? `Session completed${this.iAmLearner(s) ? '' : `: +${this.label(s.credits)}`} 🎉`
          : 'Confirmed. Waiting for the other person.';
    }
  }
}
