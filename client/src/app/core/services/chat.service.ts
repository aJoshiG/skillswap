import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, CursorMeta } from '../models/api.model';
import { Conversation, LastMessage, Message } from '../models/chat.model';
import { AuthService } from './auth.service';
import { SocketService } from './socket.service';

/** Conversation list state plus chat actions (HTTP for history, socket for live traffic). */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly socket = inject(SocketService);
  private readonly auth = inject(AuthService);
  private readonly api = `${environment.apiUrl}/conversations`;

  readonly conversations = signal<Conversation[]>([]);
  readonly loaded = signal(false);
  /** The conversation currently open on screen (its new messages count as read). */
  readonly activeId = signal<string | null>(null);
  readonly totalUnread = computed(() =>
    this.conversations().reduce((sum, c) => sum + (c.unreadCount ?? 0), 0),
  );

  constructor() {
    this.socket
      .on<{ conversationId: string; lastMessage: LastMessage }>('conversation:updated')
      .subscribe(({ conversationId, lastMessage }) =>
        this.onConversationUpdated(conversationId, lastMessage),
      );
  }

  loadConversations(): void {
    this.http.get<ApiResponse<Conversation[]>>(this.api).subscribe({
      next: (res) => {
        this.conversations.set(res.data);
        this.loaded.set(true);
        this.socket.queryPresence(
          res.data.map((c) => c.otherUser?._id).filter((id): id is string => !!id),
        );
      },
      error: () => this.loaded.set(true),
    });
  }

  getConversation(id: string): Observable<Conversation> {
    return this.http
      .get<ApiResponse<Conversation>>(`${this.api}/${id}`)
      .pipe(map((res) => res.data));
  }

  getMessages(id: string, before?: string): Observable<{ items: Message[]; meta: CursorMeta }> {
    let params = new HttpParams().set('limit', 30);
    if (before) params = params.set('before', before);
    return this.http
      .get<ApiResponse<Message[]>>(`${this.api}/${id}/messages`, { params })
      .pipe(map((res) => ({ items: res.data, meta: res.meta as unknown as CursorMeta })));
  }

  join(id: string): Promise<unknown> {
    return this.socket.request('conversation:join', { conversationId: id });
  }

  leave(id: string): void {
    this.socket.emit('conversation:leave', { conversationId: id });
  }

  send(id: string, text: string): Promise<Message> {
    return this.socket.request<Message>('message:send', { conversationId: id, text });
  }

  markRead(id: string): void {
    this.socket.request('message:read', { conversationId: id }).catch(() => undefined);
    this.conversations.update((list) =>
      list.map((c) => (c._id === id ? { ...c, unreadCount: 0 } : c)),
    );
  }

  typing(id: string, isTyping: boolean): void {
    this.socket.emit('typing', { conversationId: id, isTyping });
  }

  private onConversationUpdated(conversationId: string, lastMessage: LastMessage) {
    const exists = this.conversations().some((c) => c._id === conversationId);
    if (!exists) {
      // A brand-new conversation (e.g. a request was just accepted): reload the list.
      this.loadConversations();
      return;
    }
    const fromOther = lastMessage.sender !== this.auth.user()?._id;
    const isOpen = this.activeId() === conversationId;
    this.conversations.update((list) =>
      list
        .map((c) =>
          c._id === conversationId
            ? {
                ...c,
                lastMessage,
                updatedAt: lastMessage.createdAt ?? c.updatedAt,
                unreadCount: fromOther && !isOpen ? (c.unreadCount ?? 0) + 1 : c.unreadCount,
              }
            : c,
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    );
  }
}
