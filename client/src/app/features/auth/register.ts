import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { errorMessage } from '../../core/models/api.model';
import { AuthService } from '../../core/services/auth.service';
import { Spinner } from '../../shared/components/spinner';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const { password, confirm } = group.value as { password: string; confirm: string };
  return password && confirm && password !== confirm ? { mismatch: true } : null;
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, Spinner],
  template: `
    <div class="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div class="card w-full max-w-md p-8">
        <h1 class="text-2xl font-bold">Create your account</h1>
        <p class="mt-1 text-sm text-slate-500">Teach what you know. Learn what you love.</p>

        <form [formGroup]="form" (ngSubmit)="submit()" class="mt-6 space-y-4" novalidate>
          <div>
            <label class="label" for="name">Full name</label>
            <input id="name" class="input" formControlName="name" autocomplete="name" />
            @if (form.controls.name.touched && form.controls.name.invalid) {
              <p class="field-error">Name must be at least 2 characters.</p>
            }
          </div>
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
              autocomplete="new-password"
            />
            @if (form.controls.password.touched && form.controls.password.invalid) {
              <p class="field-error">Use at least 8 characters.</p>
            }
          </div>
          <div>
            <label class="label" for="confirm">Confirm password</label>
            <input
              id="confirm"
              type="password"
              class="input"
              formControlName="confirm"
              autocomplete="new-password"
            />
            @if (form.controls.confirm.touched && form.hasError('mismatch')) {
              <p class="field-error">Passwords don't match.</p>
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
            Create account
          </button>
        </form>

        <p class="mt-6 text-center text-sm text-slate-500">
          Already have an account?
          <a routerLink="/login" class="font-semibold text-brand-600 hover:underline">Log in</a>
        </p>
      </div>
    </div>
  `,
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
      confirm: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, email, password } = this.form.getRawValue();
    this.loading.set(true);
    this.error.set('');
    this.auth.register({ name, email, password }).subscribe({
      // New users go straight to their profile to add skills.
      next: () => this.router.navigate(['/profile/edit'], { queryParams: { welcome: 1 } }),
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
