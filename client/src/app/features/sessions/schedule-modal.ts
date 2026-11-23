import { Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { errorMessage } from '../../core/models/api.model';
import { SESSION_DURATIONS, SessionMode, creditLabel } from '../../core/models/session.model';
import { Skill } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { SessionService } from '../../core/services/session.service';
import { ToastService } from '../../core/services/toast.service';
import { Modal } from '../../shared/components/modal';
import { Spinner } from '../../shared/components/spinner';

/** The accepted swap a session is scheduled within. */
export interface SwapForScheduling {
  requestId: string;
  /** The requester and the recipient of the swap request. */
  fromId: string;
  toId: string;
  skill: Omit<Skill, '_id'>;
  offeredSkill: Omit<Skill, '_id'> | null;
  otherName: string;
}

/** "2026-11-24T18:00" in local time, for <input type="datetime-local">. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

@Component({
  selector: 'app-schedule-modal',
  imports: [ReactiveFormsModule, Modal, Spinner],
  template: `
    <app-modal [title]="'Schedule a session with ' + firstName()" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
        <fieldset>
          <legend class="label">What will you do?</legend>
          <div class="mt-1 space-y-2">
            @for (opt of options(); track opt.value) {
              <label
                class="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition"
                [class]="
                  form.value.skill === opt.value
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-slate-200 hover:border-slate-300'
                "
              >
                <input
                  type="radio"
                  formControlName="skill"
                  [value]="opt.value"
                  class="accent-brand-600"
                />
                <span>{{ opt.label }}</span>
              </label>
            }
          </div>
        </fieldset>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label for="when" class="label">When</label>
            <input
              id="when"
              type="datetime-local"
              class="input"
              formControlName="when"
              [min]="minWhen"
            />
          </div>
          <div>
            <label for="duration" class="label">How long</label>
            <select id="duration" class="input" formControlName="durationMinutes">
              @for (d of durations; track d) {
                <option [ngValue]="d">
                  {{ d < 60 ? d + ' min' : d / 60 + (d === 60 ? ' hour' : ' hours') }}
                </option>
              }
            </select>
          </div>
        </div>

        <fieldset>
          <legend class="label">Where</legend>
          <div class="mt-1 inline-flex rounded-lg bg-slate-100 p-1">
            @for (m of modes; track m.value) {
              <button
                type="button"
                class="rounded-md px-3 py-1.5 text-sm font-medium transition"
                [class]="
                  form.value.mode === m.value
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500'
                "
                [attr.aria-pressed]="form.value.mode === m.value"
                (click)="form.controls.mode.setValue(m.value)"
              >
                {{ m.label }}
              </button>
            }
          </div>
        </fieldset>

        <div>
          <label for="note" class="label"
            >Note <span class="font-normal text-slate-400">(optional)</span></label
          >
          <input
            id="note"
            class="input"
            formControlName="note"
            maxlength="300"
            [placeholder]="
              form.value.mode === 'online'
                ? 'e.g. Zoom link coming in chat'
                : 'e.g. Café near the station'
            "
          />
        </div>

        <p class="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          💳 Costs <strong>{{ price() }}</strong>, paid by
          <strong>{{ iAmLearner() ? 'you' : firstName() }}</strong>. Credits are held when
          {{ firstName() }} accepts, refunded if it's cancelled before it starts, and paid to the
          teacher once you both confirm it happened.
          @if (shortOfCredits()) {
            <span class="mt-1 block font-medium text-amber-700">
              You have {{ myBalance() }} right now, so this can't be accepted until you earn more by
              teaching.
            </span>
          }
        </p>

        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" (click)="closed.emit()">Cancel</button>
          <button type="submit" class="btn-primary" [disabled]="sending() || form.invalid">
            @if (sending()) {
              <app-spinner />
            }
            Propose session
          </button>
        </div>
      </form>
    </app-modal>
  `,
})
export class ScheduleModal {
  private readonly auth = inject(AuthService);
  private readonly sessions = inject(SessionService);
  private readonly toast = inject(ToastService);

  readonly swap = input.required<SwapForScheduling>();
  readonly closed = output<void>();
  readonly proposed = output<void>();

  protected readonly durations = SESSION_DURATIONS;
  protected readonly modes: { value: SessionMode; label: string }[] = [
    { value: 'online', label: '💻 Online' },
    { value: 'in-person', label: '📍 In person' },
  ];
  protected readonly minWhen = toLocalInput(new Date());
  protected readonly sending = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    skill: 'requested' as 'requested' | 'offered',
    when: [toLocalInput(this.tomorrowEvening()), Validators.required],
    durationMinutes: 60,
    mode: 'online' as SessionMode,
    note: '',
  });
  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly firstName = computed(() => this.swap().otherName.split(' ')[0]);
  private readonly me = computed(() => this.auth.user()?._id);

  /** The swap's two directions, phrased from my point of view. */
  protected readonly options = computed(() => {
    const s = this.swap();
    const name = this.firstName();
    // 'requested' is taught by the request's recipient; 'offered' by the requester.
    const phrase = (teacherId: string, skill: string) =>
      teacherId === this.me() ? `You teach ${name} ${skill}` : `${name} teaches you ${skill}`;
    const out: { value: 'requested' | 'offered'; label: string }[] = [
      { value: 'requested', label: phrase(s.toId, s.skill.name) },
    ];
    if (s.offeredSkill)
      out.push({ value: 'offered' as const, label: phrase(s.fromId, s.offeredSkill.name) });
    return out;
  });

  protected readonly iAmLearner = computed(() => {
    const s = this.swap();
    const learnerId = this.value().skill === 'offered' ? s.toId : s.fromId;
    return learnerId === this.me();
  });
  protected readonly price = computed(() => creditLabel((this.value().durationMinutes ?? 60) / 60));
  protected readonly myBalance = computed(() => creditLabel(this.sessions.balance() ?? 0));
  protected readonly shortOfCredits = computed(
    () =>
      this.iAmLearner() &&
      (this.sessions.balance() ?? 0) < (this.value().durationMinutes ?? 60) / 60,
  );

  private tomorrowEvening(): Date {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(18, 0, 0, 0);
    return d;
  }

  submit() {
    const v = this.form.getRawValue();
    const when = new Date(v.when);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      this.toast.error('Pick a time in the future');
      return;
    }
    this.sending.set(true);
    this.sessions
      .propose({
        requestId: this.swap().requestId,
        skill: v.skill,
        scheduledAt: when.toISOString(),
        durationMinutes: v.durationMinutes,
        mode: v.mode,
        note: v.note,
      })
      .subscribe({
        next: () => {
          this.toast.success(`Session proposed. ${this.firstName()} will be notified.`);
          this.proposed.emit();
        },
        error: (err) => {
          this.toast.error(errorMessage(err));
          this.sending.set(false);
        },
      });
  }
}
