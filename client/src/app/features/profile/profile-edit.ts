import { TitleCasePipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { errorMessage } from '../../core/models/api.model';
import {
  Availability,
  SKILL_CATEGORIES,
  SKILL_LEVELS,
  Skill,
  SkillCategory,
  SkillLevel,
} from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { UserService } from '../../core/services/user.service';
import { Avatar } from '../../shared/components/avatar';
import { Spinner } from '../../shared/components/spinner';

type SkillForm = FormGroup<{
  name: FormControl<string>;
  category: FormControl<SkillCategory>;
  level: FormControl<SkillLevel>;
}>;

@Component({
  selector: 'app-profile-edit',
  imports: [ReactiveFormsModule, RouterLink, TitleCasePipe, Avatar, Spinner],
  template: `
    <div class="page max-w-3xl">
      @if (welcome()) {
        <div class="mb-6 rounded-2xl border border-brand-200 bg-brand-50 p-5">
          <h2 class="font-semibold text-brand-800">Welcome to SkillSwap! 🎉</h2>
          <p class="mt-1 text-sm text-brand-700">
            Add a few skills you can teach and want to learn. That's how other people will find you.
          </p>
        </div>
      }

      <h1 class="text-3xl font-bold">Edit profile</h1>

      <form [formGroup]="form" (ngSubmit)="save()" class="mt-6 space-y-6" novalidate>
        <section class="card space-y-4 p-6">
          <h2 class="text-lg font-semibold">About you</h2>
          <div class="flex items-center gap-4">
            <app-avatar [src]="form.value.avatarUrl" [name]="form.value.name ?? ''" size="lg" />
            <div class="flex-1">
              <label class="label" for="avatarUrl">Avatar URL</label>
              <div class="flex gap-2">
                <input
                  id="avatarUrl"
                  class="input"
                  formControlName="avatarUrl"
                  placeholder="https://…"
                />
                <button type="button" class="btn-secondary shrink-0" (click)="generateAvatar()">
                  Generate
                </button>
              </div>
            </div>
          </div>
          <div>
            <label class="label" for="name">Name</label>
            <input id="name" class="input" formControlName="name" />
            @if (form.controls.name.touched && form.controls.name.invalid) {
              <p class="field-error">Name must be at least 2 characters.</p>
            }
          </div>
          <div>
            <label class="label" for="bio">Bio</label>
            <textarea
              id="bio"
              rows="3"
              class="input resize-none"
              formControlName="bio"
              maxlength="500"
              placeholder="What do you love teaching? What are you curious about?"
            ></textarea>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="label" for="city">City</label>
              <input id="city" class="input" formControlName="city" />
            </div>
            <div>
              <label class="label" for="country">Country</label>
              <input id="country" class="input" formControlName="country" />
            </div>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="label" for="availability">I can swap</label>
              <select id="availability" class="input" formControlName="availability">
                <option value="online">Online</option>
                <option value="in-person">In person</option>
                <option value="both">Online & in person</option>
              </select>
            </div>
            <div>
              <label class="label" for="languages"
                >Languages <span class="font-normal text-slate-500">(comma separated)</span></label
              >
              <input
                id="languages"
                class="input"
                formControlName="languages"
                placeholder="English, Hindi"
              />
            </div>
          </div>
        </section>

        @for (section of skillSections; track section.key) {
          <section class="card p-6">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-lg font-semibold">{{ section.title }}</h2>
                <p class="text-sm text-slate-500">{{ section.hint }}</p>
              </div>
              <button
                type="button"
                class="btn-secondary btn-sm"
                (click)="addSkill(section.key)"
                [disabled]="skills(section.key).length >= 15"
              >
                + Add
              </button>
            </div>
            <div class="mt-4 space-y-3" [formArrayName]="section.key">
              @for (group of skills(section.key).controls; track group; let i = $index) {
                <div class="grid grid-cols-12 gap-2" [formGroupName]="i">
                  <input
                    class="input col-span-12 sm:col-span-5"
                    formControlName="name"
                    placeholder="Skill, e.g. Guitar"
                    aria-label="Skill name"
                  />
                  <select
                    class="input col-span-5 sm:col-span-3"
                    formControlName="category"
                    aria-label="Category"
                  >
                    @for (c of categories; track c) {
                      <option [value]="c">{{ c | titlecase }}</option>
                    }
                  </select>
                  <select
                    class="input col-span-5 sm:col-span-3"
                    formControlName="level"
                    aria-label="Level"
                  >
                    @for (l of levels; track l) {
                      <option [value]="l">{{ l | titlecase }}</option>
                    }
                  </select>
                  <button
                    type="button"
                    class="btn-ghost col-span-2 sm:col-span-1"
                    (click)="skills(section.key).removeAt(i)"
                    aria-label="Remove skill"
                  >
                    ✕
                  </button>
                </div>
              } @empty {
                <p class="text-sm text-slate-500">No skills yet. Click “Add” to list one.</p>
              }
            </div>
          </section>
        }

        <div class="flex justify-end gap-2">
          <a [routerLink]="['/users', auth.user()?._id]" class="btn-ghost">View public profile</a>
          <button type="submit" class="btn-primary" [disabled]="saving()">
            @if (saving()) {
              <app-spinner />
            }
            Save changes
          </button>
        </div>
      </form>
    </div>
  `,
})
export class ProfileEdit implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly users = inject(UserService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;

  /** ?welcome=1 after registration. */
  readonly welcome = input<string>();

  protected readonly saving = signal(false);
  protected readonly categories = SKILL_CATEGORIES;
  protected readonly levels = SKILL_LEVELS;
  protected readonly skillSections = [
    {
      key: 'skillsOffered' as const,
      title: 'Skills I can teach',
      hint: 'What could you help someone learn?',
    },
    {
      key: 'skillsWanted' as const,
      title: 'Skills I want to learn',
      hint: 'What are you curious about?',
    },
  ];

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    bio: ['', Validators.maxLength(500)],
    avatarUrl: [''],
    city: [''],
    country: [''],
    availability: ['online' as Availability],
    languages: [''],
    skillsOffered: this.fb.array<SkillForm>([]),
    skillsWanted: this.fb.array<SkillForm>([]),
  });

  ngOnInit() {
    const user = this.auth.user();
    if (!user) return;
    this.form.patchValue({
      name: user.name,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      city: user.location.city,
      country: user.location.country,
      availability: user.availability,
      languages: user.languages.join(', '),
    });
    user.skillsOffered.forEach((s) => this.addSkill('skillsOffered', s));
    user.skillsWanted.forEach((s) => this.addSkill('skillsWanted', s));
  }

  protected skills(key: 'skillsOffered' | 'skillsWanted'): FormArray<SkillForm> {
    return this.form.controls[key];
  }

  protected addSkill(key: 'skillsOffered' | 'skillsWanted', skill?: Skill) {
    this.skills(key).push(
      this.fb.group({
        name: [skill?.name ?? '', [Validators.required, Validators.maxLength(60)]],
        category: [skill?.category ?? ('other' as SkillCategory)],
        level: [skill?.level ?? ('beginner' as SkillLevel)],
      }),
    );
  }

  protected generateAvatar() {
    const seed = encodeURIComponent(this.form.value.name || 'skillswap');
    this.form.controls.avatarUrl.setValue(
      `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}`,
    );
  }

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Please fix the highlighted fields.');
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.users
      .updateMe({
        name: v.name,
        bio: v.bio,
        avatarUrl: v.avatarUrl.trim(),
        location: { city: v.city.trim(), country: v.country.trim() },
        availability: v.availability,
        languages: v.languages
          .split(',')
          .map((l) => l.trim())
          .filter(Boolean),
        skillsOffered: v.skillsOffered,
        skillsWanted: v.skillsWanted,
      })
      .subscribe({
        next: (user) => {
          this.saving.set(false);
          this.toast.success('Profile saved');
          if (this.welcome()) this.router.navigate(['/matches']);
          else this.router.navigate(['/users', user._id]);
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.error(errorMessage(err));
        },
      });
  }
}
