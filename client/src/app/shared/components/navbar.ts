import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';
import { RequestService } from '../../core/services/request.service';
import { SessionService } from '../../core/services/session.service';
import { Avatar } from './avatar';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive, Avatar],
  template: `
    <header class="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav class="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <a
          routerLink="/"
          class="flex items-center gap-2 font-display text-lg font-extrabold text-slate-900"
        >
          <span class="grid size-8 place-items-center rounded-lg bg-brand-600 text-white">⇄</span>
          Skill<span class="-ml-2 text-brand-600">Swap</span>
        </a>

        @if (auth.user(); as user) {
          <div class="hidden items-center gap-1 md:flex">
            @for (link of links; track link.path) {
              <a
                [routerLink]="link.path"
                routerLinkActive="!bg-brand-50 !text-brand-700"
                class="btn-ghost relative"
              >
                {{ link.label }}
                @if (badge(link.path); as count) {
                  <span class="rounded-full bg-brand-600 px-1.5 text-[10px] leading-4 text-white">{{
                    count
                  }}</span>
                }
              </a>
            }
          </div>

          <div class="relative ml-auto flex items-center gap-2">
            @if (sessions.balance() !== null) {
              <a
                routerLink="/sessions"
                class="hidden items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-100 sm:flex"
                [attr.aria-label]="'Your time credits: ' + sessions.balance()"
                title="Your time credits"
              >
                ⏱ {{ sessions.balance() }}
              </a>
            }
            <button
              class="flex items-center gap-2 rounded-full p-1 pr-3 hover:bg-slate-100"
              (click)="menuOpen.set(!menuOpen())"
              [attr.aria-expanded]="menuOpen()"
              aria-haspopup="menu"
            >
              <app-avatar [src]="user.avatarUrl" [name]="user.name" size="sm" />
              <span class="hidden text-sm font-medium sm:inline">{{
                user.name.split(' ')[0]
              }}</span>
              <span class="text-xs text-slate-500">▾</span>
            </button>
            @if (menuOpen()) {
              <div class="fixed inset-0 z-40" (click)="menuOpen.set(false)"></div>
              <div
                role="menu"
                class="card absolute right-0 z-50 mt-2 w-56 overflow-hidden py-1 shadow-lg"
                (click)="menuOpen.set(false)"
              >
                <div class="border-b border-slate-100 px-4 py-2">
                  <p class="truncate text-sm font-semibold">{{ user.name }}</p>
                  <p class="truncate text-xs text-slate-500">{{ user.email }}</p>
                  @if (sessions.balance() !== null) {
                    <a
                      routerLink="/sessions"
                      class="mt-1 inline-block text-xs font-semibold text-brand-700 sm:hidden"
                      >⏱ {{ sessions.balance() }} credits</a
                    >
                  }
                </div>
                <div class="md:hidden">
                  @for (link of links; track link.path) {
                    <a
                      role="menuitem"
                      [routerLink]="link.path"
                      class="flex justify-between px-4 py-2 text-sm hover:bg-slate-50"
                    >
                      {{ link.label }}
                      @if (badge(link.path); as count) {
                        <span
                          class="rounded-full bg-brand-600 px-1.5 text-[10px] leading-4 text-white"
                          >{{ count }}</span
                        >
                      }
                    </a>
                  }
                </div>
                <a
                  role="menuitem"
                  [routerLink]="['/users', user._id]"
                  class="block px-4 py-2 text-sm hover:bg-slate-50"
                  >My public profile</a
                >
                <a
                  role="menuitem"
                  routerLink="/profile/edit"
                  class="block px-4 py-2 text-sm hover:bg-slate-50"
                  >Edit profile</a
                >
                <button
                  role="menuitem"
                  class="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  (click)="auth.logout()"
                >
                  Log out
                </button>
              </div>
            }
          </div>
        } @else {
          <div class="ml-auto flex items-center gap-2">
            <a routerLink="/login" class="btn-ghost">Log in</a>
            <a routerLink="/register" class="btn-primary">Get started</a>
          </div>
        }
      </nav>
    </header>
  `,
})
export class Navbar {
  protected readonly auth = inject(AuthService);
  private readonly chat = inject(ChatService);
  private readonly requests = inject(RequestService);
  protected readonly sessions = inject(SessionService);

  protected readonly menuOpen = signal(false);
  protected readonly links = [
    { path: '/matches', label: 'Matches' },
    { path: '/explore', label: 'Explore' },
    { path: '/requests', label: 'Requests' },
    { path: '/messages', label: 'Messages' },
    { path: '/sessions', label: 'Sessions' },
  ];

  protected badge(path: string): number {
    if (path === '/requests') return this.requests.pendingReceived();
    if (path === '/messages') return this.chat.totalUnread();
    if (path === '/sessions') return this.sessions.needsAction();
    return 0;
  }
}
