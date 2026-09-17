import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { environment } from './env';
import { ApiError } from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private readonly http: HttpClient) {}

  get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request(() =>
      lastValueFrom(this.http.get<T>(this.url(path), { params: this.toParams(params) })),
    );
  }

  post<T>(path: string, body: unknown, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request(() =>
      lastValueFrom(this.http.post<T>(this.url(path), body, { params: this.toParams(params) })),
    );
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request(() => lastValueFrom(this.http.patch<T>(this.url(path), body)));
  }

  delete<T>(path: string): Promise<T> {
    return this.request(() => lastValueFrom(this.http.delete<T>(this.url(path))));
  }

  private async request<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (err) {
      if (err instanceof HttpErrorResponse) {
        throw this.toApiError(err);
      }
      throw err;
    }
  }

  private toApiError(err: HttpErrorResponse): ApiError {
    const body = err.error as { code?: string; errors?: string[] } | null;
    const errors = Array.isArray(body?.errors) && body.errors.length ? body.errors : [];
    const fallback = err.status === 0 ? 'The server is unreachable. Please try again later.' : 'Something went wrong.';
    return {
      code: body?.code ?? 'UNKNOWN_ERROR',
      statusCode: err.status,
      message: errors[0] ?? fallback,
      errors,
    };
  }

  private url(path: string): string {
    return `${environment.apiUrl}${path}`;
  }

  private toParams(params?: Record<string, string | number | boolean | undefined>): HttpParams {
    let http = new HttpParams();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') {
          http = http.set(key, String(value));
        }
      }
    }
    return http;
  }
}