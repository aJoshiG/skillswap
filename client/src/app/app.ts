import { Component, effect, inject, untracked } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { ChatService } from './core/services/chat.service';
import { RequestService } from './core/services/request.service';
import { Navbar } from './shared/components/navbar';
import { ToastContainer } from './shared/components/toast-container';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, ToastContainer],
  template: `
    <a
      href="#main"
      class="btn-primary sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
    >
      Skip to content
    </a>
    <app-navbar />
    <main id="main"><router-outlet /></main>
    <app-toast-container />
  `,
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly chat = inject(ChatService);
  private readonly requests = inject(RequestService);

  constructor() {
    // Load the navbar badge counts whenever someone logs in.
    effect(() => {
      if (!this.auth.isLoggedIn()) return;
      untracked(() => {
        this.requests.refreshPendingCount();
        this.chat.loadConversations();
      });
    });
  }
}
