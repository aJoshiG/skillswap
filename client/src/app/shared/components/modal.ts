import {
  Component,
  DOCUMENT,
  ElementRef,
  HostListener,
  OnDestroy,
  afterNextRender,
  inject,
  input,
  output,
} from '@angular/core';

/** Stays interactive while a dialog is open, so toasts are still announced. */
const KEEP_LIVE = 'app-toast-container';

/**
 * Accessible dialog: renders above the page, makes the page behind it inert (no Tab or screen
 * reader access to background content), moves focus into the dialog, and returns focus to the
 * element that opened it on close. Escape and the backdrop close it.
 */
@Component({
  selector: 'app-modal',
  template: `
    <div class="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" (click)="closed.emit()"></div>
      <div
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
        class="card relative max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto p-6 shadow-xl"
      >
        <div class="mb-4 flex items-start justify-between gap-4">
          <h2 class="text-lg font-semibold">{{ title() }}</h2>
          <button
            type="button"
            class="btn-ghost -m-2 p-2"
            (click)="closed.emit()"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <ng-content />
      </div>
    </div>
  `,
})
export class Modal implements OnDestroy {
  readonly title = input('');
  readonly closed = output<void>();

  private readonly document = inject(DOCUMENT);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly opener = this.document.activeElement as HTMLElement | null;
  private readonly inerted: Element[] = [];

  constructor() {
    afterNextRender(() => {
      // Render at the end of <body>, outside the regions that become inert.
      this.document.body.appendChild(this.host);
      // Everything else in the app (skip link, navbar, page) becomes inert.
      const app = this.document.querySelector('app-root');
      for (const el of Array.from(app?.children ?? [])) {
        if (el.matches(KEEP_LIVE) || el.hasAttribute('inert')) continue;
        el.setAttribute('inert', '');
        this.inerted.push(el);
      }
      const focusable = this.host.querySelector<HTMLElement>(
        '[role="dialog"] input:not([type="hidden"]), [role="dialog"] select, [role="dialog"] textarea, [role="dialog"] button:not([aria-label="Close"])',
      );
      (focusable ?? this.host.querySelector<HTMLElement>('[role="dialog"] button'))?.focus();
    });
  }

  ngOnDestroy() {
    // The host was moved to <body>, so Angular's own removal (from its original parent) misses it.
    this.host.remove();
    for (const el of this.inerted) el.removeAttribute('inert');
    this.opener?.focus?.();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closed.emit();
  }
}
