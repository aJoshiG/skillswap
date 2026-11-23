import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, firstValueFrom, map, of, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.model';
import { User } from '../models/user.model';

interface Session {
  user: User;
  accessToken: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto extends LoginDto {
  name: string;
}

/**
 * Token strategy: the short-lived access token lives only in memory (a signal), so it
 * can't be read from storage by injected scripts. The refresh token is an httpOnly
 * cookie the browser sends to /api/auth/refresh; on page load we call refresh to
 * restore the session.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly api = `${environment.apiUrl}/auth`;

  private readonly _user = signal<User | null>(null);
  private readonly _token = signal<string | null>(null);
  private refreshInFlight$: Observable<string> | null = null;

  readonly user = this._user.asReadonly();
  readonly token = this._token.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);

  login(dto: LoginDto): Observable<User> {
    return this.http
      .post<ApiResponse<Session>>(`${this.api}/login`, dto)
      .pipe(map((res) => this.setSession(res.data)));
  }

  register(dto: RegisterDto): Observable<User> {
    return this.http
      .post<ApiResponse<Session>>(`${this.api}/register`, dto)
      .pipe(map((res) => this.setSession(res.data)));
  }

  /** Exchanges the refresh cookie for a new access token. Concurrent callers share one request. */
  refresh(): Observable<string> {
    if (!this.refreshInFlight$) {
      this.refreshInFlight$ = this.http.post<ApiResponse<Session>>(`${this.api}/refresh`, {}).pipe(
        map((res) => {
          this.setSession(res.data);
          return res.data.accessToken;
        }),
        finalize(() => (this.refreshInFlight$ = null)),
        shareReplay(1),
      );
    }
    return this.refreshInFlight$;
  }

  /** Runs once at startup; a missing or expired cookie just means "logged out". */
  restoreSession(): Promise<unknown> {
    return firstValueFrom(this.refresh().pipe(catchError(() => of(null))));
  }

  logout(): void {
    this.http
      .post(`${this.api}/logout`, {})
      .pipe(catchError(() => of(null)))
      .subscribe();
    this.clearSession();
    this.router.navigate(['/login']);
  }

  clearSession(): void {
    this._user.set(null);
    this._token.set(null);
  }

  /** Keeps the cached user in sync after profile edits. */
  setUser(user: User): void {
    this._user.set(user);
  }

  private setSession(session: Session): User {
    this._token.set(session.accessToken);
    this._user.set(session.user);
    return session.user;
  }
}
