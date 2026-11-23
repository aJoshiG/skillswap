import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, Paged, PageMeta } from '../models/api.model';
import {
  CreditSummary,
  ProposeSession,
  Session,
  SessionAction,
  SessionEvent,
  SessionScope,
  creditLabel,
} from '../models/session.model';
import { NewReview, Review } from '../models/review.model';
import { AuthService } from './auth.service';
import { SocketService } from './socket.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly socket = inject(SocketService);
  private readonly toast = inject(ToastService);
  private readonly api = `${environment.apiUrl}/sessions`;

  /** My spendable credits (navbar). */
  readonly balance = signal<number | null>(null);
  /** Sessions waiting on me: proposals to answer, or started sessions to confirm (navbar badge). */
  readonly needsAction = signal(0);
  /** Bumps whenever a session I'm part of changes, so open pages can reload. */
  readonly changed = signal(0);

  constructor() {
    this.socket.on<SessionEvent>('session:updated').subscribe(({ session, action, by }) => {
      this.toast.info(this.describe(session, action, by));
      this.changed.update((n) => n + 1);
      this.refresh();
    });
    this.socket.on<Review>('review:new').subscribe((r) => {
      this.toast.info(`${r.reviewer.name} left you a ${r.rating}★ review for ${r.skill.name}`);
    });
  }

  review(sessionId: string, body: NewReview): Observable<Review> {
    return this.http
      .post<ApiResponse<Review>>(`${this.api}/${sessionId}/review`, body)
      .pipe(map((res) => res.data));
  }

  propose(body: ProposeSession): Observable<Session> {
    return this.http.post<ApiResponse<Session>>(this.api, body).pipe(
      map((res) => res.data),
      tap(() => this.refresh()),
    );
  }

  list(scope: SessionScope, page = 1, limit = 20): Observable<Paged<Session>> {
    const params = new HttpParams().set('scope', scope).set('page', page).set('limit', limit);
    return this.http
      .get<ApiResponse<Session[]>>(this.api, { params })
      .pipe(map((res) => ({ items: res.data, meta: res.meta as PageMeta })));
  }

  respond(id: string, action: SessionAction): Observable<Session> {
    return this.http.patch<ApiResponse<Session>>(`${this.api}/${id}/${action}`, {}).pipe(
      map((res) => res.data),
      tap(() => this.refresh()),
    );
  }

  credits(limit = 10): Observable<CreditSummary> {
    const params = new HttpParams().set('limit', limit);
    return this.http
      .get<ApiResponse<CreditSummary>>(`${environment.apiUrl}/credits`, { params })
      .pipe(map((res) => res.data));
  }

  /** What I need to do about a session right now, if anything. */
  myAction(s: Session): 'answer' | 'confirm' | null {
    const me = this.auth.user()?._id;
    if (!me) return null;
    if (s.status === 'proposed' && s.proposedBy !== me) return 'answer';
    const started = new Date(s.scheduledAt).getTime() <= Date.now();
    if (s.status === 'scheduled' && started && !s.confirmedBy.includes(me)) return 'confirm';
    return null;
  }

  /** Reloads the balance and the "needs action" count. */
  refresh(): void {
    this.credits(1).subscribe({ next: (c) => this.balance.set(c.balance), error: () => undefined });
    this.list('active', 1, 50).subscribe({
      next: (res) => this.needsAction.set(res.items.filter((s) => this.myAction(s)).length),
      error: () => undefined,
    });
  }

  private describe(s: Session, action: SessionEvent['action'], by: string): string {
    const what = `${s.skill.name} session`;
    switch (action) {
      case 'proposed':
        return `${by} proposed a ${what}`;
      case 'accepted':
        return `${by} accepted the ${what}`;
      case 'declined':
        return `${by} declined the ${what}`;
      case 'cancelled':
        return `${by} cancelled the ${what}`;
      case 'confirmed':
        return `${by} confirmed the ${what} took place. Confirm it too to complete it.`;
      case 'auto-completed':
        return `${what} completed automatically: ${creditLabel(s.credits)} paid to ${s.teacher.name}`;
      case 'expired':
        return `${what} expired without confirmation: ${creditLabel(s.credits)} refunded to ${s.learner.name}`;
      default:
        return `${what} completed: ${creditLabel(s.credits)} paid to ${s.teacher.name}`;
    }
  }
}
