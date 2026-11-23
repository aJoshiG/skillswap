import { Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  template: `
    <div
      class="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-full max-w-sm flex-col gap-2"
      aria-live="polite"
    >
      @for (toast of toasts.toasts(); track toast.id) {
        <div
          class="pointer-events-auto flex items-start gap-3 rounded-xl border bg-white p-4 text-sm shadow-lg"
          [class]="
            toast.kind === 'success'
              ? 'border-emerald-200'
              : toast.kind === 'error'
                ? 'border-red-200'
                : 'border-brand-200'
          "
        >
          <span aria-hidden="true">{{
            toast.kind === 'success' ? '✅' : toast.kind === 'error' ? '⚠️' : '🔔'
          }}</span>
          <p class="flex-1 text-slate-700">{{ toast.message }}</p>
          <button
            class="text-slate-400 hover:text-slate-600"
            (click)="toasts.dismiss(toast.id)"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastContainer {
  protected readonly toasts = inject(ToastService);
}
