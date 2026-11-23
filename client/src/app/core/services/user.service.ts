import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, Paged, PageMeta } from '../models/api.model';
import { Review } from '../models/review.model';
import {
  ExploreQuery,
  MatchedUser,
  ProfileUpdate,
  PublicProfile,
  PublicUser,
  User,
} from '../models/user.model';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly api = `${environment.apiUrl}/users`;

  explore(query: ExploreQuery): Observable<Paged<PublicUser>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '')
        params = params.set(key, String(value));
    }
    return this.http
      .get<ApiResponse<PublicUser[]>>(this.api, { params })
      .pipe(map((res) => ({ items: res.data, meta: res.meta as PageMeta })));
  }

  /** People whose skills line up with yours, best match first. */
  matches(page = 1, limit = 12): Observable<Paged<MatchedUser>> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http
      .get<ApiResponse<MatchedUser[]>>(`${this.api}/matches`, { params })
      .pipe(map((res) => ({ items: res.data, meta: res.meta as PageMeta })));
  }

  getById(id: string): Observable<PublicProfile> {
    return this.http
      .get<ApiResponse<PublicProfile>>(`${this.api}/${id}`)
      .pipe(map((res) => res.data));
  }

  /** Reviews a user has received, newest first. */
  reviews(id: string, page = 1, limit = 5): Observable<Paged<Review>> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http
      .get<ApiResponse<Review[]>>(`${this.api}/${id}/reviews`, { params })
      .pipe(map((res) => ({ items: res.data, meta: res.meta as PageMeta })));
  }

  updateMe(update: ProfileUpdate): Observable<User> {
    return this.http.patch<ApiResponse<User>>(`${this.api}/me`, update).pipe(
      map((res) => res.data),
      tap((user) => this.auth.setUser(user)),
    );
  }
}
