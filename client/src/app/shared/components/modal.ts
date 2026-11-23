import { Component, HostListener, input, output } from '@angular/core';

@Component({
  selector: 'app-modal',
  template: `
    <div class="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" (click)="closed.emit()"></div>
      <div
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
        class="card relative w-full max-w-lg p-6 shadow-xl"
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
export class Modal {
  readonly title = input('');
  readonly closed = output<void>();

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closed.emit();
  }
}
