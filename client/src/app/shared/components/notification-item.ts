import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AppNotification,
  describeNotification,
  splitLink,
} from '../../core/models/notification.model';
import { TimeAgoPipe } from '../pipes/time-ago.pipe';
import { Avatar } from './avatar';

/** One notification row: who/what, when, unread marker; clicking follows its link. */
@Component({
  selector: 'app-notification-item',
  imports: [RouterLink, Avatar, TimeAgoPipe],
  template: `
    <a
      [routerLink]="target().path"
      [fragment]="target().fragment"
      class="flex items-start gap-3 px-4 py-3 transition hover:bg-slate-50 focus-visible:bg-slate-50"
      [class.bg-brand-50]="!n().readAt"
      (click)="opened.emit(n())"
    >
      <span class="relative shrink-0">
        @if (n().actor; as a) {
          <app-avatar [src]="a.avatarUrl" [name]="a.name" size="sm" />
        } @else {
          <span class="grid size-8 place-items-center rounded-full bg-brand-600 text-sm text-white"
            >⇄</span
          >
        }
        <span class="absolute -right-1 -bottom-1 text-sm" aria-hidden="true">{{
          view().icon
        }}</span>
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-sm text-slate-800" [class.font-semibold]="!n().readAt">{{
          view().text
        }}</span>
        <span class="text-xs text-slate-600">{{ n().createdAt | timeAgo }}</span>
      </span>
      @if (!n().readAt) {
        <span class="mt-1.5 size-2 shrink-0 rounded-full bg-brand-600" aria-hidden="true"></span>
        <span class="sr-only">(unread)</span>
      }
    </a>
  `,
})
export class NotificationItem {
  readonly n = input.required<AppNotification>();
  readonly opened = output<AppNotification>();
  protected readonly view = computed(() => describeNotification(this.n()));
  protected readonly target = computed(() => splitLink(this.n().link));
}
