import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { errorMessage } from '../../core/models/api.model';
import { AuthService, LoginDto } from '../../core/services/auth.service';
import { Spinner } from '../../shared/components/spinner';

const DEMO: LoginDto = { email: 'demo@skillswap.dev', password: 'password123' };

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, Spinner],
  template: `
    <div class="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div class="card w-full max-w-md p-8">
        <h1 class="text-2xl font-bold">Welcome back</h1>
        <p class="mt-1 text-sm text-slate-500">Log in to keep swapping skills.</p>

        <form [formGroup]="form" (ngSubmit)="submit()" class="mt-6 space-y-4" novalidate>
          <div>
            <label class="label" for="email">Email</label>
            <input
              id="email"
              type="email"
              class="input"
              formControlName="email"
              autocomplete="email"
            />
            @if (form.controls.email.touched && form.controls.email.invalid) {
              <p class="field-error">Enter a valid email address.</p>
            }
          </div>
          <div>
            <label class="label" for="password">Password</label>
            <input
              id="password"
              type="password"
              class="input"
              formControlName="password"
              autocomplete="current-password"
            />
            @if (form.controls.password.touched && form.controls.password.invalid) {
              <p class="field-error">Password is required.</p>
            }
          </div>

          @if (error()) {
            <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {{ error() }}
            </p>
          }

          <button type="submit" class="btn-primary w-full" [disabled]="loading()">
            @if (loading()) {
              <app-spinner />
            }
            Log in
          </button>
        </form>

        <div class="my-6 flex items-center gap-3 text-xs text-slate-400">
          <span class="h-px flex-1 bg-slate-200"></span>or<span
            class="h-px flex-1 bg-slate-200"
          ></span>
        </div>
        <button
          type="button"
          class="btn-secondary w-full"
          [disabled]="loading()"
          (click)="tryDemo()"
        >
          🚀 Try the demo account
        </button>

        <p class="mt-6 text-center text-sm text-slate-500">
          New here?
          <a routerLink="/register" class="font-semibold text-brand-600 hover:underline"
            >Create an account</a
          >
        </p>
      </div>
    </div>
  `,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Bound from the ?returnUrl= query param. */
  readonly returnUrl = input<string>();

  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.login(this.form.getRawValue());
  }

  tryDemo() {
    this.form.setValue(DEMO);
    this.login(DEMO);
  }

  private login(dto: LoginDto) {
    this.loading.set(true);
    this.error.set('');
    this.auth.login(dto).subscribe({
      next: () => this.router.navigateByUrl(this.safeReturnUrl()),
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  // Only allow in-app paths, so the param can't redirect users to another site.
  private safeReturnUrl() {
    const url = this.returnUrl();
    return url && url.startsWith('/') && !url.startsWith('//') ? url : '/explore';
  }
}
