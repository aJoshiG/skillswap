import { Component, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppNotification } from '../../core/models/notification.model';
import { NotificationService } from '../../core/services/notification.service';
import { NotificationItem } from './notification-item';

/** Navbar bell: unread badge and a dropdown of the latest notifications. */
@Component({
  selector: 'app-notification-bell',
  imports: [RouterLink, NotificationItem],
  template: `
    <div class="relative">
      <button
        #trigger
        type="button"
        class="relative grid size-9 place-items-center rounded-full text-lg text-slate-600 hover:bg-slate-100"
        [attr.aria-label]="label()"
        [attr.aria-expanded]="open()"
        aria-controls="notification-panel"
        (click)="toggle()"
      >
        <span aria-hidden="true">🔔</span>
        @if (notifications.unread(); as count) {
          <span
            class="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] leading-4 font-semibold text-white"
            aria-hidden="true"
            >{{ count > 9 ? '9+' : count }}</span
          >
        }
      </button>

      @if (open()) {
        <div class="fixed inset-0 z-40" (click)="close()" aria-hidden="true"></div>
        <section
          id="notification-panel"
          aria-label="Notifications"
          class="card fixed inset-x-2 top-16 z-50 max-h-[70vh] overflow-hidden shadow-lg sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-96"
        >
          <header class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 class="font-semibold">Notifications</h2>
            @if (notifications.unread()) {
              <button
                type="button"
                class="text-xs font-medium text-brand-700 hover:underline"
                (click)="markAll()"
              >
                Mark all as read
              </button>
            }
          </header>
          <ul class="max-h-[calc(70vh-6rem)] divide-y divide-slate-100 overflow-y-auto">
            @for (n of notifications.recent(); track n._id) {
              <li><app-notification-item [n]="n" (opened)="opened($event)" /></li>
            } @empty {
              <li class="px-4 py-8 text-center text-sm text-slate-500">
                You're all caught up. Requests, sessions and reviews will show up here.
              </li>
            }
          </ul>
          <footer class="border-t border-slate-100 px-4 py-2 text-center">
            <a
              routerLink="/notifications"
              class="text-sm font-medium text-brand-700 hover:underline"
              (click)="close()"
              >View all</a
            >
          </footer>
        </section>
      }
    </div>
  `,
})
export class NotificationBell {
  protected readonly notifications = inject(NotificationService);
  protected readonly open = signal(false);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  protected label() {
    const n = this.notifications.unread();
    return n ? `Notifications, ${n} unread` : 'Notifications';
  }

  protected toggle() {
    this.open.update((o) => !o);
    if (this.open()) this.notifications.refresh();
  }

  protected close() {
    this.open.set(false);
  }

  protected opened(n: AppNotification) {
    this.notifications.markRead(n);
    this.close();
  }

  protected markAll() {
    this.notifications.markAllRead().subscribe();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (!this.open()) return;
    this.close();
    this.trigger().nativeElement.focus();
  }
}
