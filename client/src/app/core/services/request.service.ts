import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, Paged, PageMeta } from '../models/api.model';
import {
  CreateRequest,
  RequestAction,
  RequestBox,
  RequestStatus,
  RespondResult,
  SwapRequest,
} from '../models/request.model';
import { SocketService } from './socket.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class RequestService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/requests`;

  private readonly socket = inject(SocketService);
  private readonly toast = inject(ToastService);

  /** Pending requests waiting for my answer (navbar badge). */
  readonly pendingReceived = signal(0);
  /** Emits whenever a request I'm part of changes in realtime, so open lists can reload. */
  readonly changed = signal(0);

  constructor() {
    this.socket.on<SwapRequest>('request:new').subscribe((req) => {
      this.pendingReceived.update((n) => n + 1);
      this.changed.update((n) => n + 1);
      this.toast.info(`${req.from.name} wants to learn ${req.skill.name} from you`);
    });
    this.socket.on<RespondResult>('request:updated').subscribe(({ request }) => {
      this.changed.update((n) => n + 1);
      if (request.status === 'accepted') {
        this.toast.success(
          `${request.to.name} accepted your ${request.skill.name} request. Say hi in Messages!`,
        );
      } else if (request.status === 'declined') {
        this.toast.info(`${request.to.name} declined your ${request.skill.name} request`);
      } else if (request.status === 'cancelled') {
        this.refreshPendingCount();
      }
    });
  }

  create(body: CreateRequest): Observable<SwapRequest> {
    return this.http.post<ApiResponse<SwapRequest>>(this.api, body).pipe(map((res) => res.data));
  }

  list(box: RequestBox, status?: RequestStatus, page = 1): Observable<Paged<SwapRequest>> {
    let params = new HttpParams().set('box', box).set('page', page).set('limit', 20);
    if (status) params = params.set('status', status);
    return this.http
      .get<ApiResponse<SwapRequest[]>>(this.api, { params })
      .pipe(map((res) => ({ items: res.data, meta: res.meta as PageMeta })));
  }

  respond(id: string, action: RequestAction): Observable<RespondResult> {
    return this.http.patch<ApiResponse<RespondResult>>(`${this.api}/${id}/${action}`, {}).pipe(
      map((res) => res.data),
      tap(() => this.refreshPendingCount()),
    );
  }

  refreshPendingCount(): void {
    this.list('received', 'pending').subscribe({
      next: (res) => this.pendingReceived.set(res.meta.total),
      error: () => undefined,
    });
  }
}
