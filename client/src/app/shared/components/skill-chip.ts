import { Component, input } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { Skill } from '../../core/models/user.model';

const LEVEL_DOTS = { beginner: 1, intermediate: 2, expert: 3 } as const;

@Component({
  selector: 'app-skill-chip',
  imports: [TitleCasePipe],
  template: `
    <span
      class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      [class]="
        variant() === 'offer'
          ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200'
          : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
      "
      [title]="skill().category + ' · ' + skill().level"
    >
      {{ skill().name }}
      @if (showLevel()) {
        <span class="flex gap-0.5" role="img" [attr.aria-label]="skill().level | titlecase">
          @for (dot of [1, 2, 3]; track dot) {
            <span
              class="size-1.5 rounded-full"
              [class]="dot <= dots() ? 'bg-current' : 'bg-current opacity-25'"
            ></span>
          }
        </span>
      }
    </span>
  `,
})
export class SkillChip {
  readonly skill = input.required<Pick<Skill, 'name' | 'category' | 'level'>>();
  readonly variant = input<'offer' | 'want'>('offer');
  readonly showLevel = input(true);

  protected dots() {
    return LEVEL_DOTS[this.skill().level] ?? 1;
  }
}
