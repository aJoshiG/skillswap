import { Component, OnInit, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';
import { SocketService } from '../../core/services/socket.service';
import { Avatar } from '../../shared/components/avatar';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { ChatThread } from './chat-thread';

@Component({
  selector: 'app-messages',
  imports: [RouterLink, Avatar, TimeAgoPipe, ChatThread],
  template: `
    <div class="mx-auto flex h-[calc(100vh-4rem)] max-w-6xl p-0 sm:p-4">
      <div class="card flex min-h-0 flex-1 overflow-hidden rounded-none sm:rounded-2xl">
        <!-- Conversation list: full width on mobile until a chat is open -->
        <aside
          class="w-full shrink-0 flex-col border-r border-slate-200 md:flex md:w-80"
          [class.hidden]="!!id()"
          [class.flex]="!id()"
        >
          <div class="border-b border-slate-200 px-4 py-4">
            <h1 class="text-xl font-bold">Messages</h1>
          </div>
          <ul class="flex-1 overflow-y-auto">
            @if (!chat.loaded()) {
              @for (i of [1, 2, 3, 4]; track i) {
                <li class="flex gap-3 px-4 py-3">
                  <div class="skeleton size-10 rounded-full"></div>
                  <div class="flex-1 space-y-2">
                    <div class="skeleton h-3 w-24"></div>
                    <div class="skeleton h-3 w-40"></div>
                  </div>
                </li>
              }
            }
            @for (c of chat.conversations(); track c._id) {
              <li>
                <a
                  [routerLink]="['/messages', c._id]"
                  class="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50"
                  [class.bg-brand-50]="c._id === id()"
                >
                  <app-avatar
                    [src]="c.otherUser?.avatarUrl"
                    [name]="c.otherUser?.name ?? ''"
                    [online]="socket.isOnline(c.otherUser?._id)"
                  />
                  <div class="min-w-0 flex-1">
                    <div class="flex items-baseline justify-between gap-2">
                      <p class="truncate text-sm font-semibold">
                        {{ c.otherUser?.name ?? 'Deleted user' }}
                      </p>
                      <span class="shrink-0 text-[11px] text-slate-400">{{
                        c.lastMessage.createdAt ?? c.updatedAt | timeAgo
                      }}</span>
                    </div>
                    <div class="flex items-center justify-between gap-2">
                      <p
                        class="truncate text-xs"
                        [class]="c.unreadCount ? 'font-semibold text-slate-800' : 'text-slate-500'"
                      >
                        @if (c.lastMessage.text) {
                          {{ c.lastMessage.sender === auth.user()?._id ? 'You: ' : ''
                          }}{{ c.lastMessage.text }}
                        } @else {
                          {{ c.request.skill.name }} swap · say hi 👋
                        }
                      </p>
                      @if (c.unreadCount) {
                        <span
                          class="shrink-0 rounded-full bg-brand-600 px-1.5 text-[10px] leading-4 font-semibold text-white"
                          >{{ c.unreadCount }}</span
                        >
                      }
                    </div>
                  </div>
                </a>
              </li>
            } @empty {
              @if (chat.loaded()) {
                <li class="px-6 py-12 text-center text-sm text-slate-500">
                  <p class="text-3xl">💬</p>
                  <p class="mt-2">
                    No conversations yet. A chat opens when a swap request is accepted.
                  </p>
                  <a routerLink="/requests" class="btn-secondary mt-4">View requests</a>
                </li>
              }
            }
          </ul>
        </aside>

        @if (id(); as conversationId) {
          <app-chat-thread [conversationId]="conversationId" />
        } @else {
          <div
            class="hidden flex-1 flex-col items-center justify-center bg-slate-50 text-center text-slate-500 md:flex"
          >
            <p class="text-4xl">💬</p>
            <p class="mt-3 font-medium">Select a conversation</p>
            <p class="text-sm">Pick someone on the left to keep planning your swap.</p>
          </div>
        }
      </div>
    </div>
  `,
})
export class Messages implements OnInit {
  protected readonly chat = inject(ChatService);
  protected readonly socket = inject(SocketService);
  protected readonly auth = inject(AuthService);

  /** Optional :id route param. */
  readonly id = input<string>();

  ngOnInit() {
    this.chat.loadConversations();
  }
}
