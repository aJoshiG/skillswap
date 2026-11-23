import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <div
      class="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 text-center"
    >
      <p class="font-display text-7xl font-extrabold text-brand-500">404</p>
      <h1 class="mt-4 text-2xl font-bold">This page swapped itself out</h1>
      <p class="mt-2 text-slate-500">The page you're looking for doesn't exist or has moved.</p>
      <a routerLink="/" class="btn-primary mt-8">Back to home</a>
    </div>
  `,
})
export class NotFound {}
