import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { errorMessage } from '../../core/models/api.model';
import { Session } from '../../core/models/session.model';
import { AuthService } from '../../core/services/auth.service';
import { SessionService } from '../../core/services/session.service';
import { ToastService } from '../../core/services/toast.service';
import { Modal } from '../../shared/components/modal';
import { RatingInput } from '../../shared/components/rating-input';
import { Spinner } from '../../shared/components/spinner';

@Component({
  selector: 'app-review-modal',
  imports: [ReactiveFormsModule, Modal, RatingInput, Spinner],
  template: `
    <app-modal [title]="'Review ' + otherName()" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
        <p class="text-sm text-slate-600">
          How was your {{ session().skill.name }} session
          {{ iTaught() ? 'teaching' : 'learning from' }} {{ otherName().split(' ')[0] }}?
        </p>
        <app-rating-input formControlName="rating" />
        <div>
          <label for="comment" class="label">
            Comment
            <span class="font-normal text-slate-400">(optional, shown on their profile)</span>
          </label>
          <textarea
            id="comment"
            rows="3"
            class="input"
            formControlName="comment"
            maxlength="500"
            [placeholder]="
              iTaught()
                ? 'e.g. Came prepared and asked great questions'
                : 'e.g. Patient, clear and fun'
            "
          ></textarea>
          <p class="mt-1 text-right text-xs text-slate-400">
            {{ form.value.comment?.length ?? 0 }}/500
          </p>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" (click)="closed.emit()">Later</button>
          <button type="submit" class="btn-primary" [disabled]="sending() || !form.value.rating">
            @if (sending()) {
              <app-spinner />
            }
            Post review
          </button>
        </div>
      </form>
    </app-modal>
  `,
})
export class ReviewModal {
  private readonly auth = inject(AuthService);
  private readonly sessions = inject(SessionService);
  private readonly toast = inject(ToastService);

  readonly session = input.required<Session>();
  readonly closed = output<void>();
  readonly reviewed = output<void>();

  protected readonly sending = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    rating: [0, [Validators.min(1), Validators.max(5)]],
    comment: ['', Validators.maxLength(500)],
  });

  protected iTaught = () => this.session().teacher._id === this.auth.user()?._id;
  protected otherName = () =>
    this.iTaught() ? this.session().learner.name : this.session().teacher.name;

  submit() {
    const { rating, comment } = this.form.getRawValue();
    if (!rating) return;
    this.sending.set(true);
    this.sessions.review(this.session()._id, { rating, comment }).subscribe({
      next: () => {
        this.toast.success('Thanks! Your review is on their profile.');
        this.reviewed.emit();
      },
      error: (err) => {
        this.toast.error(errorMessage(err));
        this.sending.set(false);
      },
    });
  }
}
