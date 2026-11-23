import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, Paged, PageMeta } from '../models/api.model';
import { AppNotification } from '../models/notification.model';
import { SocketService } from './socket.service';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly socket = inject(SocketService);
  private readonly api = `${environment.apiUrl}/notifications`;

  /** Unread count (navbar bell badge). */
  readonly unread = signal(0);
  /** The latest few, for the bell dropdown. */
  readonly recent = signal<AppNotification[]>([]);
  /** Bumps whenever a notification arrives, so an open notifications page can reload. */
  readonly changed = signal(0);

  constructor() {
    // Toasts for live events are shown by the feature services; this only keeps the bell current.
    this.socket.on<AppNotification>('notification:new').subscribe((n) => {
      this.recent.update((list) => [n, ...list.filter((x) => x._id !== n._id)].slice(0, 10));
      this.unread.update((c) => c + 1);
      this.changed.update((c) => c + 1);
    });
  }

  list(page = 1, limit = 20, unreadOnly = false): Observable<Paged<AppNotification>> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (unreadOnly) params = params.set('unread', 'true');
    return this.http
      .get<ApiResponse<AppNotification[]>>(this.api, { params })
      .pipe(map((res) => ({ items: res.data, meta: res.meta as PageMeta })));
  }

  /** Reloads the unread count (cheap; done on every login / app start). */
  refreshCount(): void {
    this.http.get<ApiResponse<{ count: number }>>(`${this.api}/unread-count`).subscribe({
      next: (res) => this.unread.set(res.data.count),
      error: () => undefined,
    });
  }

  /** Reloads the count and the latest 10 (when the bell dropdown opens). */
  refresh(): void {
    this.refreshCount();
    this.list(1, 10).subscribe({
      next: (res) => this.recent.set(res.items),
      error: () => undefined,
    });
  }

  /** Marks one as read, updating the bell straight away (and rolling back if the server fails). */
  markRead(n: AppNotification): void {
    if (n.readAt) return;
    const now = new Date().toISOString();
    this.setRead(n._id, now);
    this.unread.update((c) => Math.max(0, c - 1));
    this.http.patch(`${this.api}/${n._id}/read`, {}).subscribe({
      error: () => {
        this.setRead(n._id, null);
        this.unread.update((c) => c + 1);
      },
    });
  }

  markAllRead(): Observable<unknown> {
    return this.http.patch(`${this.api}/read-all`, {}).pipe(
      map((res) => {
        const now = new Date().toISOString();
        this.recent.update((list) => list.map((x) => (x.readAt ? x : { ...x, readAt: now })));
        this.unread.set(0);
        this.changed.update((c) => c + 1);
        return res;
      }),
    );
  }

  private setRead(id: string, readAt: string | null) {
    this.recent.update((list) => list.map((x) => (x._id === id ? { ...x, readAt } : x)));
  }
}
