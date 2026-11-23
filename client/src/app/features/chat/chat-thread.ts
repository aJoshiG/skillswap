import { DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { errorMessage } from '../../core/models/api.model';
import { Conversation, Message } from '../../core/models/chat.model';
import { AuthService } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';
import { SocketService } from '../../core/services/socket.service';
import { ToastService } from '../../core/services/toast.service';
import { Avatar } from '../../shared/components/avatar';
import { SkillChip } from '../../shared/components/skill-chip';
import { Spinner } from '../../shared/components/spinner';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { ScheduleModal } from '../sessions/schedule-modal';

const TYPING_IDLE_MS = 2000;

@Component({
  selector: 'app-chat-thread',
  imports: [
    FormsModule,
    RouterLink,
    DatePipe,
    Avatar,
    SkillChip,
    Spinner,
    TimeAgoPipe,
    ScheduleModal,
  ],
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  template: `
    @if (conversation(); as c) {
      <header class="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        <a
          routerLink="/messages"
          class="btn-ghost -ml-2 px-2 md:hidden"
          aria-label="Back to conversations"
          >←</a
        >
        <a [routerLink]="['/users', c.otherUser?._id]" class="flex min-w-0 items-center gap-3">
          <app-avatar
            [src]="c.otherUser?.avatarUrl"
            [name]="c.otherUser?.name ?? ''"
            [online]="otherOnline()"
          />
          <div class="min-w-0">
            <p class="truncate font-semibold">{{ c.otherUser?.name }}</p>
            <p class="text-xs text-slate-500">
              @if (otherTyping()) {
                <span class="text-brand-600">typing…</span>
              } @else if (otherOnline()) {
                <span class="text-emerald-600">Online</span>
              } @else {
                Active {{ c.otherUser?.lastActiveAt | timeAgo }}
              }
            </p>
          </div>
        </a>
        <div class="ml-auto hidden items-center gap-1.5 text-xs text-slate-500 lg:flex">
          <app-skill-chip [skill]="c.request.skill" [showLevel]="false" />
          @if (c.request.offeredSkill) {
            ⇄ <app-skill-chip [skill]="c.request.offeredSkill" variant="want" [showLevel]="false" />
          }
        </div>
        @if (c.request.status === 'accepted') {
          <button
            class="btn-secondary btn-sm ml-auto shrink-0 lg:ml-2"
            (click)="scheduling.set(true)"
            aria-label="Schedule a session"
          >
            📅 <span class="hidden sm:inline">Schedule</span>
          </button>
        }
      </header>
      @if (scheduling()) {
        <app-schedule-modal
          [swap]="{
            requestId: c.request._id,
            fromId: c.request.from,
            toId: c.request.to,
            skill: c.request.skill,
            offeredSkill: c.request.offeredSkill,
            otherName: c.otherUser?.name ?? 'them',
          }"
          (closed)="scheduling.set(false)"
          (proposed)="scheduling.set(false)"
        />
      }

      <div
        #scroller
        class="flex-1 space-y-1 overflow-y-auto bg-slate-50 px-4 py-4"
        (scroll)="onScroll()"
      >
        @if (hasMore()) {
          <div class="mb-3 text-center">
            <button class="btn-ghost btn-sm" [disabled]="loadingOlder()" (click)="loadOlder()">
              @if (loadingOlder()) {
                <app-spinner />
              }
              Load earlier messages
            </button>
          </div>
        }
        @for (m of messages(); track m._id; let i = $index) {
          @let mine = m.sender === me();
          @if (showDay(i)) {
            <p class="py-3 text-center text-[11px] font-medium text-slate-400">
              {{ m.createdAt | date: 'EEEE, d MMM' }}
            </p>
          }
          <div class="flex" [class.justify-end]="mine">
            <div
              class="max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words shadow-sm"
              [class]="
                mine
                  ? 'rounded-br-md bg-brand-600 text-white'
                  : 'rounded-bl-md bg-white text-slate-800'
              "
              [class.opacity-60]="m.pending"
            >
              {{ m.text }}
              <span
                class="mt-0.5 block text-right text-[10px]"
                [class]="mine ? 'text-brand-100' : 'text-slate-400'"
              >
                {{ m.createdAt | date: 'shortTime' }}
                @if (mine) {
                  <span [title]="m.readAt ? 'Seen' : m.pending ? 'Sending' : 'Delivered'">{{
                    m.pending ? '🕓' : m.readAt ? '✓✓' : '✓'
                  }}</span>
                }
              </span>
            </div>
          </div>
        } @empty {
          @if (!loading()) {
            <div
              class="flex h-full flex-col items-center justify-center text-center text-sm text-slate-500"
            >
              <p class="text-3xl">👋</p>
              <p class="mt-2">Say hello and plan your first swap session!</p>
            </div>
          }
        }
        @if (lastSeenLabel()) {
          <p class="pt-1 text-right text-[11px] text-slate-400">{{ lastSeenLabel() }}</p>
        }
      </div>

      <form class="flex items-end gap-2 border-t border-slate-200 bg-white p-3" (ngSubmit)="send()">
        <label for="composer" class="sr-only">Message</label>
        <textarea
          id="composer"
          rows="1"
          class="input max-h-32 min-h-10 flex-1 resize-none"
          placeholder="Write a message…"
          maxlength="2000"
          [(ngModel)]="draft"
          name="draft"
          (input)="onTyping()"
          (keydown.enter)="onEnter($any($event))"
        ></textarea>
        <button type="submit" class="btn-primary h-10" [disabled]="!draft.trim()">Send</button>
      </form>
    } @else if (loading()) {
      <div class="flex flex-1 items-center justify-center text-brand-600">
        <app-spinner size="md" />
      </div>
    } @else {
      <div class="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate-500">
        {{ error() }}
      </div>
    }
  `,
})
export class ChatThread {
  private readonly chat = inject(ChatService);
  private readonly socket = inject(SocketService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  readonly conversationId = input.required<string>();

  protected readonly conversation = signal<Conversation | null>(null);
  /** Whether the schedule-a-session dialog is open. */
  protected readonly scheduling = signal(false);
  protected readonly messages = signal<Message[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadingOlder = signal(false);
  protected readonly hasMore = signal(false);
  protected readonly error = signal('');
  protected readonly otherTyping = signal(false);
  protected draft = '';

  protected readonly me = computed(() => this.auth.user()?._id);
  protected readonly otherOnline = computed(() =>
    this.socket.isOnline(this.conversation()?.otherUser?._id),
  );
  /** "Seen 2 minutes ago" under my last message, like most chat apps. */
  protected readonly lastSeenLabel = computed(() => {
    const list = this.messages();
    const last = list[list.length - 1];
    if (!last || last.sender !== this.me() || last.pending) return '';
    return last.readAt ? 'Seen' : '';
  });

  private nextCursor: string | null = null;
  private stickToBottom = true;
  private typingTimer: ReturnType<typeof setTimeout> | undefined;
  private otherTypingTimer: ReturnType<typeof setTimeout> | undefined;
  private isTyping = false;
  private joinedId: string | null = null;

  constructor() {
    effect(() => {
      const id = this.conversationId();
      untracked(() => this.open(id));
    });

    // (Re)join the socket room on first connect and after every reconnect.
    effect(() => {
      const connected = this.socket.connected();
      const id = this.conversationId();
      untracked(() => {
        // Rooms are lost when the socket drops, so forget the old join.
        if (!connected) this.joinedId = null;
        else this.joinRoom(id);
      });
    });

    this.socket
      .on<Message>('message:new')
      .pipe(takeUntilDestroyed())
      .subscribe((m) => this.onIncoming(m));

    this.socket
      .on<{ conversationId: string; userId: string; isTyping: boolean }>('typing')
      .pipe(takeUntilDestroyed())
      .subscribe(({ conversationId, isTyping }) => {
        if (conversationId !== this.conversationId()) return;
        this.otherTyping.set(isTyping);
        clearTimeout(this.otherTypingTimer);
        // Safety net in case the "stopped typing" event never arrives.
        if (isTyping) this.otherTypingTimer = setTimeout(() => this.otherTyping.set(false), 5000);
      });

    this.socket
      .on<{ conversationId: string; readerId: string; readAt: string }>('message:read')
      .pipe(takeUntilDestroyed())
      .subscribe(({ conversationId, readerId, readAt }) => {
        if (conversationId !== this.conversationId() || readerId === this.me()) return;
        this.messages.update((list) =>
          list.map((m) => (m.sender === this.me() && !m.readAt ? { ...m, readAt } : m)),
        );
      });

    this.destroyRef.onDestroy(() => {
      if (this.joinedId) this.chat.leave(this.joinedId);
      this.chat.activeId.set(null);
      this.stopTyping();
      clearTimeout(this.otherTypingTimer);
    });
  }

  private open(id: string) {
    if (this.joinedId && this.joinedId !== id) {
      this.chat.leave(this.joinedId);
      this.joinedId = null;
    }
    this.chat.activeId.set(id);
    this.loading.set(true);
    this.error.set('');
    this.conversation.set(null);
    this.messages.set([]);
    this.otherTyping.set(false);
    this.draft = '';

    this.chat.getConversation(id).subscribe({
      next: (c) => {
        this.conversation.set(c);
        if (c.otherUser) this.socket.queryPresence([c.otherUser._id]);
      },
      error: (err) => {
        this.error.set(errorMessage(err, 'This conversation could not be loaded.'));
        this.loading.set(false);
      },
    });

    this.chat.getMessages(id).subscribe({
      next: ({ items, meta }) => {
        this.messages.set(items);
        this.hasMore.set(meta.hasMore);
        this.nextCursor = meta.nextCursor;
        this.loading.set(false);
        this.chat.markRead(id);
        this.scrollToBottom();
      },
      error: () => this.loading.set(false),
    });

    if (this.socket.connected()) this.joinRoom(id);
  }

  private joinRoom(id: string) {
    if (this.joinedId === id) return;
    this.joinedId = id;
    this.chat.join(id).catch(() => (this.joinedId = null));
  }

  protected loadOlder() {
    if (!this.nextCursor) return;
    const el = this.scroller()?.nativeElement;
    const previousHeight = el?.scrollHeight ?? 0;
    this.loadingOlder.set(true);
    this.chat.getMessages(this.conversationId(), this.nextCursor).subscribe({
      next: ({ items, meta }) => {
        this.messages.update((list) => [...items, ...list]);
        this.hasMore.set(meta.hasMore);
        this.nextCursor = meta.nextCursor;
        this.loadingOlder.set(false);
        // Keep the viewport on the same message after prepending older ones.
        requestAnimationFrame(() => {
          if (el) el.scrollTop = el.scrollHeight - previousHeight;
        });
      },
      error: () => this.loadingOlder.set(false),
    });
  }

  protected async send() {
    const text = this.draft.trim();
    if (!text) return;
    this.draft = '';
    this.stopTyping();

    // Optimistic update: show the message immediately, then swap in the saved one.
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      _id: tempId,
      conversation: this.conversationId(),
      sender: this.me() ?? '',
      text,
      readAt: null,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    this.messages.update((list) => [...list, optimistic]);
    this.stickToBottom = true;
    this.scrollToBottom();

    try {
      const saved = await this.chat.send(this.conversationId(), text);
      this.messages.update((list) => {
        const withoutTemp = list.filter((m) => m._id !== tempId);
        // The broadcast may already have delivered it; don't add it twice.
        return withoutTemp.some((m) => m._id === saved._id) ? withoutTemp : [...withoutTemp, saved];
      });
    } catch (err) {
      this.messages.update((list) => list.filter((m) => m._id !== tempId));
      this.draft = text;
      this.toast.error(err instanceof Error ? err.message : 'Message failed to send');
    }
  }

  protected onEnter(event: KeyboardEvent) {
    if (event.shiftKey) return; // Shift+Enter inserts a newline
    event.preventDefault();
    this.send();
  }

  protected onTyping() {
    if (!this.isTyping) {
      this.isTyping = true;
      this.chat.typing(this.conversationId(), true);
    }
    clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => this.stopTyping(), TYPING_IDLE_MS);
  }

  protected onScroll() {
    const el = this.scroller()?.nativeElement;
    if (el) this.stickToBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  protected showDay(index: number) {
    const list = this.messages();
    if (index === 0) return true;
    return (
      new Date(list[index].createdAt).toDateString() !==
      new Date(list[index - 1].createdAt).toDateString()
    );
  }

  private onIncoming(m: Message) {
    if (m.conversation !== this.conversationId()) return;
    this.otherTyping.set(m.sender === this.me() ? this.otherTyping() : false);
    this.messages.update((list) => {
      if (list.some((x) => x._id === m._id)) return list;
      if (m.sender === this.me()) {
        // My own message echoed back before the ack: replace the optimistic copy.
        const tempIndex = list.findIndex((x) => x.pending && x.text === m.text);
        if (tempIndex !== -1) return list.map((x, i) => (i === tempIndex ? m : x));
      }
      return [...list, m];
    });
    if (m.sender !== this.me()) this.chat.markRead(this.conversationId());
    if (this.stickToBottom) this.scrollToBottom();
  }

  private stopTyping() {
    clearTimeout(this.typingTimer);
    if (this.isTyping) {
      this.isTyping = false;
      this.chat.typing(this.conversationId(), false);
    }
  }

  private scrollToBottom() {
    requestAnimationFrame(() => {
      const el = this.scroller()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
