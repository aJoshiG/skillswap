import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <section class="relative overflow-hidden">
      <div
        class="absolute inset-x-0 -top-40 -z-10 h-[32rem] bg-gradient-to-b from-brand-100 via-brand-50 to-transparent"
      ></div>
      <div class="mx-auto max-w-6xl px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28">
        <p
          class="mx-auto mb-5 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200"
        >
          No money. Just skills.
        </p>
        <h1 class="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">
          Trade what you know for <span class="text-brand-600">what you want to learn</span>
        </h1>
        <p class="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          SkillSwap connects people who teach each other. Offer guitar, learn Python. Teach Spanish,
          learn design. Find your match, send a request and start chatting in real time.
        </p>
        <div class="mt-10 flex flex-wrap justify-center gap-3">
          @if (auth.isLoggedIn()) {
            <a routerLink="/explore" class="btn-primary px-6 py-3 text-base">Explore skills →</a>
          } @else {
            <a routerLink="/register" class="btn-primary px-6 py-3 text-base"
              >Start swapping, free</a
            >
            <a routerLink="/login" class="btn-secondary px-6 py-3 text-base">Try the demo</a>
          }
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <h2 class="mb-10 text-center text-2xl font-bold sm:text-3xl">How it works</h2>
      <div class="grid gap-6 md:grid-cols-3">
        @for (step of steps; track step.title; let i = $index) {
          <div class="card p-6">
            <div class="mb-4 grid size-11 place-items-center rounded-xl bg-brand-50 text-xl">
              {{ step.icon }}
            </div>
            <p class="text-xs font-semibold tracking-wider text-brand-600 uppercase">
              Step {{ i + 1 }}
            </p>
            <h3 class="mt-1 text-lg font-semibold">{{ step.title }}</h3>
            <p class="mt-2 text-sm text-slate-600">{{ step.text }}</p>
          </div>
        }
      </div>
    </section>
  `,
})
export class Home {
  protected readonly auth = inject(AuthService);
  protected readonly steps = [
    {
      icon: '🧑‍🏫',
      title: 'List your skills',
      text: 'Add the skills you can teach and the ones you want to learn, with your level and how you like to meet.',
    },
    {
      icon: '🔎',
      title: 'Find your people',
      text: 'Search by skill, category, level or city, and see who wants exactly what you can offer.',
    },
    {
      icon: '💬',
      title: 'Request & chat',
      text: 'Send a swap request. Once it is accepted, a private real-time chat opens so you can plan your first session.',
    },
  ];
}
