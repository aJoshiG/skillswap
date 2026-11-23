import { Component, input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  template: `
    <span
      role="status"
      class="inline-block animate-spin rounded-full border-2 border-current border-t-transparent"
      [class]="size() === 'sm' ? 'size-4' : 'size-8'"
      ><span class="sr-only">Loading</span></span
    >
  `,
})
export class Spinner {
  readonly size = input<'sm' | 'md'>('sm');
}
