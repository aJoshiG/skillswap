import { Component, computed, input, signal } from '@angular/core';

const SIZES = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-16 text-lg',
  xl: 'size-24 text-2xl',
};

@Component({
  selector: 'app-avatar',
  template: `
    <span class="relative inline-flex shrink-0">
      @if (src() && !failed()) {
        <img
          [src]="src()"
          [alt]="name()"
          (error)="failed.set(true)"
          class="rounded-full bg-brand-50 object-cover ring-2 ring-white"
          [class]="sizeClass()"
        />
      } @else {
        <span
          class="inline-flex items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700 ring-2 ring-white"
          [class]="sizeClass()"
          [attr.aria-label]="name()"
          >{{ initials() }}</span
        >
      }
      @if (online()) {
        <span
          class="absolute right-0 bottom-0 size-3 rounded-full bg-emerald-500 ring-2 ring-white"
          title="Online"
        ></span>
      }
    </span>
  `,
})
export class Avatar {
  readonly src = input<string | null | undefined>('');
  readonly name = input('');
  readonly size = input<keyof typeof SIZES>('md');
  readonly online = input(false);

  protected readonly failed = signal(false);
  protected readonly sizeClass = computed(() => SIZES[this.size()]);
  protected readonly initials = computed(() =>
    this.name()
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join(''),
  );
}
