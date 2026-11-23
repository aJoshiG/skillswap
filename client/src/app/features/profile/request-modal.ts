import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { errorMessage } from '../../core/models/api.model';
import { PublicUser, Skill } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { RequestService } from '../../core/services/request.service';
import { ToastService } from '../../core/services/toast.service';
import { Modal } from '../../shared/components/modal';
import { SkillChip } from '../../shared/components/skill-chip';
import { Spinner } from '../../shared/components/spinner';

@Component({
  selector: 'app-request-modal',
  imports: [ReactiveFormsModule, Modal, SkillChip, Spinner],
  template: `
    <app-modal
      [title]="'Request a swap with ' + recipient().name.split(' ')[0]"
      (closed)="closed.emit()"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
        <div>
          <p class="label">You want to learn</p>
          <app-skill-chip [skill]="skill()" />
        </div>

        <div>
          <label class="label" for="offered"
            >What can you teach in return?
            <span class="font-normal text-slate-400">(optional)</span></label
          >
          @if (myOffered().length) {
            <select id="offered" class="input" formControlName="offeredSkillId">
              <option value="">Nothing specific yet</option>
              @for (s of myOffered(); track s._id) {
                <option [value]="s._id">
                  {{ s.name }}{{ wantedByThem(s) ? ' ★ they want this' : '' }}
                </option>
              }
            </select>
          } @else {
            <p class="text-sm text-slate-500">
              Add skills you can teach to your profile to offer something in return.
            </p>
          }
        </div>

        <div>
          <label class="label" for="message">Message</label>
          <textarea
            id="message"
            rows="4"
            class="input resize-none"
            formControlName="message"
            maxlength="500"
            placeholder="Introduce yourself and say what you'd like to learn…"
          ></textarea>
          <p class="mt-1 text-right text-xs text-slate-400">
            {{ form.value.message?.length ?? 0 }}/500
          </p>
        </div>

        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" (click)="closed.emit()">Cancel</button>
          <button type="submit" class="btn-primary" [disabled]="sending()">
            @if (sending()) {
              <app-spinner />
            }
            Send request
          </button>
        </div>
      </form>
    </app-modal>
  `,
})
export class RequestModal implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly requests = inject(RequestService);
  private readonly toast = inject(ToastService);

  readonly recipient = input.required<PublicUser>();
  readonly skill = input.required<Skill>();
  readonly closed = output<void>();
  readonly sent = output<void>();

  protected readonly sending = signal(false);
  protected readonly myOffered = computed(() => this.auth.user()?.skillsOffered ?? []);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    offeredSkillId: '',
    message: ['', Validators.maxLength(500)],
  });

  ngOnInit() {
    // Pre-select a skill the recipient actually wants, if I offer one.
    const match = this.myOffered().find((s) => this.wantedByThem(s));
    if (match?._id) this.form.controls.offeredSkillId.setValue(match._id);
  }

  protected wantedByThem(skill: Skill) {
    const name = skill.name.toLowerCase();
    return this.recipient().skillsWanted.some((w) => w.name.toLowerCase() === name);
  }

  submit() {
    const { offeredSkillId, message } = this.form.getRawValue();
    this.sending.set(true);
    this.requests
      .create({
        to: this.recipient()._id,
        skillId: this.skill()._id!,
        offeredSkillId: offeredSkillId || undefined,
        message,
      })
      .subscribe({
        next: () => {
          this.toast.success(`Request sent to ${this.recipient().name}`);
          this.sent.emit();
        },
        error: (err) => {
          this.toast.error(errorMessage(err));
          this.sending.set(false);
        },
      });
  }
}
