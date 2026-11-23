import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

const api = environment.apiUrl;
const session = (token: string) => ({
  success: true,
  data: { accessToken: token, user: { _id: 'u1', name: 'Test', email: 't@t.dev' } },
});

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => backend.verify());

  function login(token: string) {
    auth.login({ email: 't@t.dev', password: 'x' }).subscribe();
    backend.expectOne(`${api}/auth/login`).flush(session(token));
  }

  it('attaches the bearer token and credentials to API requests', () => {
    login('abc');
    http.get(`${api}/users/me`).subscribe();
    const req = backend.expectOne(`${api}/users/me`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer abc');
    expect(req.request.withCredentials).toBeTrue();
    req.flush({ success: true, data: {} });
  });

  it('does not touch requests to other origins', () => {
    login('abc');
    http.get('https://example.com/data').subscribe();
    const req = backend.expectOne('https://example.com/data');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('refreshes the token once on 401 and retries the request', () => {
    login('old');
    let result: unknown;
    http.get(`${api}/users/me`).subscribe((r) => (result = r));

    backend
      .expectOne(`${api}/users/me`)
      .flush(
        { success: false, error: { code: 'TOKEN_EXPIRED' } },
        { status: 401, statusText: 'Unauthorized' },
      );
    backend.expectOne(`${api}/auth/refresh`).flush(session('new'));

    const retry = backend.expectOne(`${api}/users/me`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new');
    retry.flush({ success: true, data: { ok: true } });
    expect(result).toEqual({ success: true, data: { ok: true } });
  });

  it('logs the user out locally when the refresh fails', () => {
    login('old');
    http.get(`${api}/users/me`).subscribe({ error: () => undefined });
    backend.expectOne(`${api}/users/me`).flush(null, { status: 401, statusText: 'Unauthorized' });
    backend
      .expectOne(`${api}/auth/refresh`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(auth.isLoggedIn()).toBeFalse();
  });
});
