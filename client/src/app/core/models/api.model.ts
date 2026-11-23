import { HttpErrorResponse } from '@angular/common/http';

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: PageMeta;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CursorMeta {
  hasMore: boolean;
  nextCursor: string | null;
}

export interface Paged<T> {
  items: T[];
  meta: PageMeta;
}

export interface ApiErrorBody {
  success: false;
  error: { code: string; message: string; details?: { field: string; message: string }[] };
}

/** Pulls a human-readable message out of any HTTP error. */
export function errorMessage(
  err: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Cannot reach the server. Check your connection.';
    const body = err.error as ApiErrorBody | null;
    const detail = body?.error?.details?.[0]?.message;
    return detail ?? body?.error?.message ?? fallback;
  }
  return fallback;
}
