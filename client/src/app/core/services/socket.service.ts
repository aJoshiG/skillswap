import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Observable } from 'rxjs';
import { Socket, io } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

interface Ack<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

/**
 * One socket.io connection for the whole app. It connects when the user logs in and
 * disconnects on logout. The access token is read on every (re)connect, so a reconnect
 * after a token refresh uses the new token.
 */
@Injectable({ providedIn: 'root' })
export class SocketService {
  private readonly auth = inject(AuthService);
  private readonly socket: Socket = io(environment.socketUrl, {
    autoConnect: false,
    withCredentials: true,
    auth: (cb) => cb({ token: this.auth.token() }),
  });

  readonly connected = signal(false);
  readonly onlineUsers = signal<ReadonlySet<string>>(new Set());

  constructor() {
    this.socket.on('connect', () => this.connected.set(true));
    this.socket.on('disconnect', () => {
      this.connected.set(false);
      this.onlineUsers.set(new Set());
    });
    // A handshake rejected for an expired token: refresh it, then reconnect.
    this.socket.on('connect_error', (err) => {
      if (err.message !== 'UNAUTHORIZED' || !this.auth.isLoggedIn()) return;
      this.auth.refresh().subscribe({ next: () => this.socket.connect(), error: () => undefined });
    });
    this.socket.on('presence:update', ({ userId, online }: { userId: string; online: boolean }) =>
      this.setPresence([userId], online),
    );

    effect(() => {
      const loggedIn = this.auth.isLoggedIn();
      untracked(() => (loggedIn ? this.socket.connect() : this.socket.disconnect()));
    });
  }

  /** Listen to a server event as an Observable; unsubscribing removes the listener. */
  on<T>(event: string): Observable<T> {
    return new Observable<T>((subscriber) => {
      const handler = (payload: T) => subscriber.next(payload);
      this.socket.on(event, handler);
      return () => this.socket.off(event, handler);
    });
  }

  emit(event: string, payload: unknown): void {
    this.socket.emit(event, payload);
  }

  /** Emits and waits for the server's acknowledgement; rejects on error or timeout. */
  async request<T>(event: string, payload: unknown): Promise<T> {
    const ack = (await this.socket.timeout(8000).emitWithAck(event, payload)) as Ack<T>;
    if (!ack.ok) throw new Error(ack.error ?? 'Request failed');
    return ack.data as T;
  }

  isOnline(userId: string | undefined | null): boolean {
    return !!userId && this.onlineUsers().has(userId);
  }

  async queryPresence(userIds: string[]): Promise<void> {
    if (!userIds.length || !this.socket.connected) return;
    const online = await this.request<string[]>('presence:query', { userIds }).catch(() => []);
    this.setPresence(online, true);
  }

  private setPresence(userIds: string[], online: boolean) {
    this.onlineUsers.update((current) => {
      const next = new Set(current);
      for (const id of userIds) {
        if (online) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }
}
