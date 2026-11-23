import { TitleCasePipe } from '@angular/common';
import { Component, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { errorMessage } from '../../core/models/api.model';
import {
  RequestAction,
  RequestBox,
  RequestStatus,
  SwapRequest,
} from '../../core/models/request.model';
import { RequestService } from '../../core/services/request.service';
import { ToastService } from '../../core/services/toast.service';
import { Avatar } from '../../shared/components/avatar';
import { EmptyState } from '../../shared/components/empty-state';
import { SkillChip } from '../../shared/components/skill-chip';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';

const STATUS_STYLES: Record<RequestStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  accepted: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  declined: 'bg-red-50 text-red-700 ring-red-200',
  cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
};

@Component({
  selector: 'app-requests',
  imports: [RouterLink, TitleCasePipe, Avatar, SkillChip, EmptyState, TimeAgoPipe],
  template: `
    <div class="page max-w-4xl">
      <h1 class="text-3xl font-bold">Swap requests</h1>

      <div class="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div class="inline-flex rounded-lg bg-slate-100 p-1" role="tablist">
          @for (tab of tabs; track tab.value) {
            <button
              role="tab"
              [attr.aria-selected]="box() === tab.value"
              class="rounded-md px-4 py-1.5 text-sm font-medium transition"
              [class]="
                box() === tab.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              "
              (click)="box.set(tab.value)"
            >
              {{ tab.label }}
              @if (tab.value === 'received' && requests.pendingReceived()) {
                <span class="ml-1 rounded-full bg-brand-600 px-1.5 text-[10px] text-white">{{
                  requests.pendingReceived()
                }}</span>
              }
            </button>
          }
        </div>
        <div class="flex flex-wrap gap-1.5">
          @for (s of statuses; track s) {
            <button
              class="rounded-full px-3 py-1 text-xs font-medium ring-1 transition"
              [class]="
                status() === s
                  ? 'bg-slate-900 text-white ring-slate-900'
                  : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300'
              "
              (click)="status.set(s)"
            >
              {{ s ? (s | titlecase) : 'All' }}
            </button>
          }
        </div>
      </div>

      <div class="mt-6 space-y-3">
        @if (loading()) {
          @for (i of [1, 2, 3]; track i) {
            <div class="card flex gap-4 p-5">
              <div class="skeleton size-10 rounded-full"></div>
              <div class="flex-1 space-y-2">
                <div class="skeleton h-4 w-1/3"></div>
                <div class="skeleton h-3 w-2/3"></div>
              </div>
            </div>
          }
        } @else {
          @for (req of items(); track req._id) {
            @let other = box() === 'received' ? req.from : req.to;
            <article class="card p-5">
              <div class="flex flex-wrap items-start gap-4">
                <a [routerLink]="['/users', other._id]"
                  ><app-avatar [src]="other.avatarUrl" [name]="other.name"
                /></a>
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <a
                      [routerLink]="['/users', other._id]"
                      class="font-semibold hover:text-brand-700"
                      >{{ other.name }}</a
                    >
                    <span
                      class="rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1"
                      [class]="statusStyle(req.status)"
                      >{{ req.status | titlecase }}</span
                    >
                    <span class="text-xs text-slate-400">{{ req.createdAt | timeAgo }}</span>
                  </div>
                  <div class="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    <span>{{ box() === 'received' ? 'Wants to learn' : 'You want to learn' }}</span>
                    <app-skill-chip [skill]="req.skill" />
                    @if (req.offeredSkill) {
                      <span>in exchange for</span>
                      <app-skill-chip [skill]="req.offeredSkill" variant="want" />
                    }
                  </div>
                  @if (req.message) {
                    <p
                      class="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm whitespace-pre-line text-slate-700"
                    >
                      “{{ req.message }}”
                    </p>
                  }
                </div>
                <div class="flex w-full gap-2 sm:w-auto">
                  @if (req.status === 'pending' && box() === 'received') {
                    <button
                      class="btn-primary btn-sm"
                      [disabled]="busyId() === req._id"
                      (click)="act(req, 'accept')"
                    >
                      Accept
                    </button>
                    <button
                      class="btn-danger btn-sm"
                      [disabled]="busyId() === req._id"
                      (click)="act(req, 'decline')"
                    >
                      Decline
                    </button>
                  }
                  @if (req.status === 'pending' && box() === 'sent') {
                    <button
                      class="btn-secondary btn-sm"
                      [disabled]="busyId() === req._id"
                      (click)="act(req, 'cancel')"
                    >
                      Cancel request
                    </button>
                  }
                  @if (req.status === 'accepted' && req.conversationId) {
                    <a [routerLink]="['/messages', req.conversationId]" class="btn-primary btn-sm"
                      >💬 Open chat</a
                    >
                  }
                </div>
              </div>
            </article>
          } @empty {
            <app-empty-state
              [icon]="box() === 'received' ? '📭' : '📤'"
              [title]="
                box() === 'received' ? 'No requests here yet' : 'You haven’t sent any requests'
              "
              [message]="
                box() === 'received'
                  ? 'Add more skills to your profile so people can find you.'
                  : 'Find someone on Explore and request a swap.'
              "
            >
              <a
                [routerLink]="box() === 'received' ? '/profile/edit' : '/explore'"
                class="btn-secondary"
              >
                {{ box() === 'received' ? 'Edit my skills' : 'Go to Explore' }}
              </a>
            </app-empty-state>
          }
        }
      </div>
    </div>
  `,
})
export class Requests {
  protected readonly requests = inject(RequestService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly tabs: { value: RequestBox; label: string }[] = [
    { value: 'received', label: 'Received' },
    { value: 'sent', label: 'Sent' },
  ];
  protected readonly statuses: (RequestStatus | '')[] = [
    '',
    'pending',
    'accepted',
    'declined',
    'cancelled',
  ];

  protected readonly box = signal<RequestBox>('received');
  protected readonly status = signal<RequestStatus | ''>('pending');
  protected readonly items = signal<SwapRequest[]>([]);
  protected readonly loading = signal(true);
  protected readonly busyId = signal<string | null>(null);

  constructor() {
    // Reload when the tab or filter changes, or a realtime update arrives.
    effect(() => {
      const box = this.box();
      const status = this.status();
      this.requests.changed();
      untracked(() => this.load(box, status));
    });
  }

  private load(box: RequestBox, status: RequestStatus | '') {
    this.loading.set(true);
    this.requests.list(box, status || undefined).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.error(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  protected statusStyle(status: RequestStatus) {
    return STATUS_STYLES[status];
  }

  protected act(req: SwapRequest, action: RequestAction) {
    this.busyId.set(req._id);
    this.requests.respond(req._id, action).subscribe({
      next: ({ request, conversationId }) => {
        this.busyId.set(null);
        if (action === 'accept' && conversationId) {
          this.toast.success(`Swap accepted! Say hi to ${request.from.name}.`);
          this.router.navigate(['/messages', conversationId]);
          return;
        }
        this.toast.info(action === 'decline' ? 'Request declined' : 'Request cancelled');
        this.load(this.box(), this.status());
      },
      error: (err) => {
        this.busyId.set(null);
        this.toast.error(errorMessage(err));
        this.load(this.box(), this.status());
      },
    });
  }
}
