import { Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  template: `
    <div class="card flex flex-col items-center px-6 py-14 text-center">
      <div class="mb-4 text-4xl" aria-hidden="true">{{ icon() }}</div>
      <h3 class="text-lg font-semibold">{{ title() }}</h3>
      @if (message()) {
        <p class="mt-1 max-w-sm text-sm text-slate-500">{{ message() }}</p>
      }
      <div class="mt-5"><ng-content /></div>
    </div>
  `,
})
export class EmptyState {
  readonly icon = input('✨');
  readonly title = input.required<string>();
  readonly message = input('');
}
