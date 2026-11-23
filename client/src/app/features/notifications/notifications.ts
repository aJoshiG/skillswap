import { Component, effect, inject, signal, untracked } from '@angular/core';
import { errorMessage } from '../../core/models/api.model';
import { AppNotification } from '../../core/models/notification.model';
import { NotificationService } from '../../core/services/notification.service';
import { ToastService } from '../../core/services/toast.service';
import { EmptyState } from '../../shared/components/empty-state';
import { NotificationItem } from '../../shared/components/notification-item';

@Component({
  selector: 'app-notifications',
  imports: [EmptyState, NotificationItem],
  template: `
    <div class="page max-w-3xl">
      <header class="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-3xl font-bold">Notifications</h1>
          <p class="mt-1 text-slate-500">Requests, sessions and reviews, newest first.</p>
        </div>
        @if (notifications.unread()) {
          <button class="btn-secondary btn-sm" (click)="markAll()">Mark all as read</button>
        }
      </header>

      <div class="mb-4 inline-flex rounded-lg bg-slate-100 p-1" role="tablist">
        @for (tab of tabs; track tab.unread) {
          <button
            role="tab"
            class="rounded-md px-4 py-1.5 text-sm font-medium transition"
            [class]="
              unreadOnly() === tab.unread ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            "
            [attr.aria-selected]="unreadOnly() === tab.unread"
            (click)="unreadOnly.set(tab.unread)"
          >
            {{ tab.label }}
            @if (tab.unread && notifications.unread()) {
              <span class="ml-1 rounded-full bg-brand-600 px-1.5 text-[10px] text-white">{{
                notifications.unread()
              }}</span>
            }
          </button>
        }
      </div>

      @if (loading() && !items().length) {
        <div class="card divide-y divide-slate-100">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="flex gap-3 px-4 py-3">
              <div class="skeleton size-8 rounded-full"></div>
              <div class="flex-1 space-y-2">
                <div class="skeleton h-3 w-2/3"></div>
                <div class="skeleton h-3 w-1/4"></div>
              </div>
            </div>
          }
        </div>
      } @else if (!items().length) {
        <app-empty-state
          icon="🔔"
          [title]="unreadOnly() ? 'No unread notifications' : 'No notifications yet'"
          message="Requests, accepted swaps, sessions and reviews will show up here."
        />
      } @else {
        <ul class="card divide-y divide-slate-100 overflow-hidden">
          @for (n of items(); track n._id) {
            <li><app-notification-item [n]="n" (opened)="notifications.markRead($event)" /></li>
          }
        </ul>
        @if (hasMore()) {
          <div class="mt-4 text-center">
            <button class="btn-secondary" [disabled]="loading()" (click)="loadMore()">
              Load more
            </button>
          </div>
        }
      }
    </div>
  `,
})
export class Notifications {
  protected readonly notifications = inject(NotificationService);
  private readonly toast = inject(ToastService);

  protected readonly tabs = [
    { unread: false, label: 'All' },
    { unread: true, label: 'Unread' },
  ];
  protected readonly unreadOnly = signal(false);
  protected readonly items = signal<AppNotification[]>([]);
  protected readonly loading = signal(true);
  protected readonly hasMore = signal(false);
  private page = 1;

  constructor() {
    // Reload on tab change and whenever a notification arrives or everything is marked read.
    effect(() => {
      this.unreadOnly();
      this.notifications.changed();
      untracked(() => this.load(1));
    });
  }

  private load(page: number) {
    this.loading.set(true);
    this.notifications.list(page, 20, this.unreadOnly()).subscribe({
      next: (res) => {
        this.page = page;
        this.items.update((list) => (page === 1 ? res.items : [...list, ...res.items]));
        this.hasMore.set(res.meta.page < res.meta.totalPages);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected loadMore() {
    this.load(this.page + 1);
  }

  protected markAll() {
    this.notifications.markAllRead().subscribe({
      error: (err) => this.toast.error(errorMessage(err)),
    });
  }
}
