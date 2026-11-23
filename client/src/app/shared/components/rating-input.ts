import { Component, computed, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

/**
 * 1–5 star picker for forms. Built on real radio buttons, so it works with the keyboard
 * (Tab, arrow keys) and screen readers; the stars are just their styled labels.
 */
@Component({
  selector: 'app-rating-input',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RatingInput), multi: true },
  ],
  template: `
    <fieldset class="flex items-center gap-3" (mouseleave)="hover.set(0)" (focusin)="hover.set(0)">
      <legend class="sr-only">Rating</legend>
      <div class="flex">
        @for (n of [1, 2, 3, 4, 5]; track n) {
          <label
            class="cursor-pointer px-0.5 text-3xl leading-none transition-transform hover:scale-110"
            [class]="n <= shown() ? 'text-amber-400' : 'text-slate-300'"
            (mousemove)="hover.set(n)"
          >
            <input
              type="radio"
              name="rating"
              class="peer sr-only"
              [value]="n"
              [checked]="value() === n"
              [disabled]="disabled()"
              (change)="select(n)"
            />
            <span
              class="rounded peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500"
              aria-hidden="true"
              >★</span
            >
            <span class="sr-only">{{ n }} star{{ n === 1 ? '' : 's' }} ({{ labels[n] }})</span>
          </label>
        }
      </div>
      <span class="text-sm font-medium text-slate-600" aria-live="polite">{{
        labels[shown()]
      }}</span>
    </fieldset>
  `,
})
export class RatingInput implements ControlValueAccessor {
  protected readonly labels = LABELS;
  protected readonly value = signal(0);
  protected readonly hover = signal(0);
  protected readonly disabled = signal(false);
  protected readonly shown = computed(() => this.hover() || this.value());

  private onChange: (v: number) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  protected select(n: number) {
    // A keyboard choice must win over a stale mouse-hover preview.
    this.hover.set(0);
    this.value.set(n);
    this.onChange(n);
    this.onTouched();
  }

  writeValue(v: number | null): void {
    this.value.set(v ?? 0);
  }
  registerOnChange(fn: (v: number) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }
}
