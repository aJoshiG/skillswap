import { TitleCasePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { PageMeta, errorMessage } from '../../core/models/api.model';
import {
  ExploreQuery,
  PublicUser,
  SKILL_CATEGORIES,
  SKILL_LEVELS,
} from '../../core/models/user.model';
import { UserService } from '../../core/services/user.service';
import { SocketService } from '../../core/services/socket.service';
import { ToastService } from '../../core/services/toast.service';
import { Avatar } from '../../shared/components/avatar';
import { EmptyState } from '../../shared/components/empty-state';
import { SkillChip } from '../../shared/components/skill-chip';

@Component({
  selector: 'app-explore',
  imports: [ReactiveFormsModule, RouterLink, TitleCasePipe, Avatar, SkillChip, EmptyState],
  template: `
    <div class="page">
      <header class="mb-6">
        <h1 class="text-3xl font-bold">Explore</h1>
        <p class="mt-1 text-slate-500">
          Find people to learn from, or people who want what you can teach.
        </p>
      </header>

      <form
        [formGroup]="filters"
        class="card mb-6 grid gap-3 p-4 md:grid-cols-12"
        (submit)="$event.preventDefault()"
      >
        <div class="md:col-span-12 xl:col-span-3">
          <label for="q" class="sr-only">Search</label>
          <input
            id="q"
            class="input"
            formControlName="q"
            placeholder="Search skills, e.g. guitar"
          />
        </div>
        <div
          class="inline-flex rounded-lg bg-slate-100 p-1 md:col-span-6 xl:col-span-3"
          role="radiogroup"
          aria-label="Search by"
        >
          @for (opt of typeOptions; track opt.value) {
            <button
              type="button"
              role="radio"
              [attr.aria-checked]="filters.value.type === opt.value"
              class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition"
              [class]="
                filters.value.type === opt.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              "
              (click)="filters.controls.type.setValue(opt.value)"
            >
              {{ opt.label }}
            </button>
          }
        </div>
        <select
          class="input md:col-span-6 xl:col-span-2"
          formControlName="category"
          aria-label="Category"
        >
          <option value="">All categories</option>
          @for (c of categories; track c) {
            <option [value]="c">{{ c | titlecase }}</option>
          }
        </select>
        <select
          class="input md:col-span-6 xl:col-span-2"
          formControlName="level"
          aria-label="Level"
        >
          <option value="">Any level</option>
          @for (l of levels; track l) {
            <option [value]="l">{{ l | titlecase }}</option>
          }
        </select>
        <select
          class="input md:col-span-6 xl:col-span-2"
          formControlName="availability"
          aria-label="Availability"
        >
          <option value="">Any format</option>
          <option value="online">Online</option>
          <option value="in-person">In person</option>
        </select>
        @if (filters.value.availability === 'in-person') {
          <input
            class="input md:col-span-6 xl:col-span-3"
            formControlName="city"
            placeholder="City, e.g. Pune"
            aria-label="City"
          />
        }
      </form>

      @if (loading() && !users().length) {
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (i of [1, 2, 3, 4, 5, 6]; track i) {
            <div class="card space-y-3 p-5">
              <div class="flex items-center gap-3">
                <div class="skeleton size-10 rounded-full"></div>
                <div class="skeleton h-4 w-32"></div>
              </div>
              <div class="skeleton h-3 w-full"></div>
              <div class="skeleton h-3 w-2/3"></div>
              <div class="flex gap-2">
                <div class="skeleton h-6 w-16 rounded-full"></div>
                <div class="skeleton h-6 w-20 rounded-full"></div>
              </div>
            </div>
          }
        </div>
      } @else if (!users().length) {
        <app-empty-state
          icon="🔍"
          title="No one matches those filters"
          message="Try a broader search or remove some filters."
        >
          <button class="btn-secondary" (click)="resetFilters()">Clear filters</button>
        </app-empty-state>
      } @else {
        <p class="mb-3 text-sm text-slate-500">
          {{ meta()?.total }} {{ meta()?.total === 1 ? 'person' : 'people' }} found
        </p>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" [class.opacity-60]="loading()">
          @for (user of users(); track user._id) {
            <a
              [routerLink]="['/users', user._id]"
              class="card group flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div class="flex items-center gap-3">
                <app-avatar
                  [src]="user.avatarUrl"
                  [name]="user.name"
                  [online]="socket.isOnline(user._id)"
                />
                <div class="min-w-0">
                  <p class="truncate font-semibold group-hover:text-brand-700">{{ user.name }}</p>
                  <p class="truncate text-xs text-slate-500">
                    {{ user.location.city || 'Anywhere' }} ·
                    {{ availabilityLabel(user.availability) }}
                  </p>
                </div>
              </div>
              @if (user.bio) {
                <p class="mt-3 line-clamp-2 text-sm text-slate-600">{{ user.bio }}</p>
              }
              <div class="mt-auto pt-4">
                <p class="mb-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                  {{ filters.value.type === 'wanted' ? 'Wants to learn' : 'Teaches' }}
                </p>
                <div class="flex flex-wrap gap-1.5">
                  @for (skill of shownSkills(user); track skill._id) {
                    <app-skill-chip
                      [skill]="skill"
                      [variant]="filters.value.type === 'wanted' ? 'want' : 'offer'"
                    />
                  }
                </div>
              </div>
            </a>
          }
        </div>

        @if (meta(); as m) {
          @if (m.totalPages > 1) {
            <nav class="mt-8 flex items-center justify-center gap-3" aria-label="Pagination">
              <button
                class="btn-secondary"
                [disabled]="m.page <= 1 || loading()"
                (click)="goTo(m.page - 1)"
              >
                ← Previous
              </button>
              <span class="text-sm text-slate-500">Page {{ m.page }} of {{ m.totalPages }}</span>
              <button
                class="btn-secondary"
                [disabled]="m.page >= m.totalPages || loading()"
                (click)="goTo(m.page + 1)"
              >
                Next →
              </button>
            </nav>
          }
        }
      }
    </div>
  `,
})
export class Explore {
  private readonly userService = inject(UserService);
  private readonly toast = inject(ToastService);
  protected readonly socket = inject(SocketService);

  protected readonly categories = SKILL_CATEGORIES;
  protected readonly levels = SKILL_LEVELS;
  protected readonly typeOptions = [
    { value: 'offered' as const, label: 'They teach' },
    { value: 'wanted' as const, label: 'They want' },
  ];

  protected readonly filters = inject(FormBuilder).nonNullable.group({
    q: '',
    type: 'offered' as 'offered' | 'wanted',
    category: '' as ExploreQuery['category'],
    level: '' as ExploreQuery['level'],
    availability: '' as ExploreQuery['availability'],
    city: '',
  });

  protected readonly users = signal<PublicUser[]>([]);
  protected readonly meta = signal<PageMeta | null>(null);
  protected readonly loading = signal(true);
  private readonly query = signal<ExploreQuery>({ ...this.filters.getRawValue(), page: 1 });

  constructor() {
    const destroyRef = inject(DestroyRef);

    this.filters.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(() => this.query.set({ ...this.filters.getRawValue(), page: 1 }));

    // switchMap cancels the previous request, so fast typing never shows stale results.
    toObservable(this.query)
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap((q) =>
          this.userService.explore({ ...q, limit: 12 }).pipe(
            catchError((err) => {
              this.toast.error(errorMessage(err));
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((res) => {
        this.loading.set(false);
        if (!res) return;
        this.users.set(res.items);
        this.meta.set(res.meta);
        this.socket.queryPresence(res.items.map((u) => u._id));
      });
  }

  protected goTo(page: number) {
    this.query.update((q) => ({ ...q, page }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected resetFilters() {
    this.filters.reset();
  }

  protected shownSkills(user: PublicUser) {
    const skills = this.filters.value.type === 'wanted' ? user.skillsWanted : user.skillsOffered;
    return skills.slice(0, 4);
  }

  protected availabilityLabel(value: PublicUser['availability']) {
    return value === 'both' ? 'Online & in person' : value === 'online' ? 'Online' : 'In person';
  }
}
