import { Component, computed, input } from '@angular/core';

type Fill = 'full' | 'half' | 'empty';

/** Read-only star rating, e.g. ★★★★½ 4.5 (12). Rounds to the nearest half star for display. */
@Component({
  selector: 'app-stars',
  template: `
    <span class="inline-flex items-center gap-1" [attr.aria-label]="label()" role="img">
      <span class="inline-flex tracking-tight" aria-hidden="true" [class]="sizeClass()">
        @for (fill of stars(); track $index) {
          @if (fill === 'half') {
            <span class="relative inline-block">
              <span class="text-slate-300">★</span>
              <span class="absolute inset-0 w-1/2 overflow-hidden text-amber-400">★</span>
            </span>
          } @else {
            <span [class]="fill === 'full' ? 'text-amber-400' : 'text-slate-300'">★</span>
          }
        }
      </span>
      @if (showValue() && value() !== null) {
        <span class="text-xs font-semibold text-slate-700" aria-hidden="true">{{
          value()!.toFixed(1)
        }}</span>
      }
      @if (count() !== null) {
        <span class="text-xs text-slate-500" aria-hidden="true">({{ count() }})</span>
      }
    </span>
  `,
})
export class Stars {
  /** Average rating 1–5, or null for "no reviews yet". */
  readonly value = input<number | null>(null);
  readonly count = input<number | null>(null);
  readonly showValue = input(true);
  readonly size = input<'sm' | 'md' | 'lg'>('sm');

  protected readonly stars = computed<Fill[]>(() => {
    const halves = Math.round((this.value() ?? 0) * 2); // 4.3 → 9 halves → 4½ stars
    return [1, 2, 3, 4, 5].map((i) =>
      halves >= i * 2 ? 'full' : halves === i * 2 - 1 ? 'half' : 'empty',
    );
  });
  protected readonly sizeClass = computed(
    () => ({ sm: 'text-sm', md: 'text-base', lg: 'text-xl' })[this.size()],
  );
  protected readonly label = computed(() => {
    const v = this.value();
    if (v === null) return 'No reviews yet';
    const c = this.count();
    return (
      `Rated ${v.toFixed(1)} out of 5` +
      (c !== null ? ` from ${c} review${c === 1 ? '' : 's'}` : '')
    );
  });
}
