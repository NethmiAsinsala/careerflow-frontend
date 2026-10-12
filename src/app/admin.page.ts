import { Component, inject, signal } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { Api, AdminUser, Page, Report, errorMessage } from "./core";
import { UI } from "./ui";
@Component({
  standalone: true,
  imports: UI,
  template: `<div class="page-heading">
      <div>
        <span class="eyebrow">COMMUNITY CARE</span>
        <h1>Manage user access.</h1>
        <p class="muted">Review accounts and keep the community healthy.</p>
      </div>
    </div>
    @if (busy()) {
      <mat-progress-bar mode="indeterminate" />
    }
    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }
    <section class="card">
      @for (u of result()?.content; track u.id) {
        <div class="list-row">
          <div>
            <h3>{{ u.email }}</h3>
            <p class="muted">
              {{ u.role }} · {{ u.active ? "Active" : "Suspended" }}
            </p>
          </div>
          <button
            mat-stroked-button
            (click)="toggle(u)"
            [disabled]="busy() || u.role === 'ADMIN'"
          >
            {{ u.active ? "Suspend" : "Reactivate" }}
          </button>
        </div>
      } @empty {
        <p class="muted">No users to display.</p>
      }
    </section>
    @if (result(); as r) {
      <div class="pagination">
        <button
          mat-button
          [disabled]="busy() || r.first"
          (click)="load(r.page - 1)"
        >
          Previous</button
        ><span>Page {{ r.page + 1 }} of {{ r.totalPages }}</span
        ><button
          mat-button
          [disabled]="busy() || r.last"
          (click)="load(r.page + 1)"
        >
          Next
        </button>
      </div>
    }`,
})
export class UsersPage {
  private api = inject(Api);
  result = signal<Page<AdminUser> | null>(null);
  busy = signal(false);
  error = signal("");
  constructor() {
    void this.load(0);
  }
  async load(page: number) {
    this.busy.set(true);
    this.error.set("");
    try {
      this.result.set(await this.api.get("/admin/users", { page, size: 20 }));
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async toggle(u: AdminUser) {
    if (!confirm((u.active ? "Suspend" : "Reactivate") + " " + u.email + "?"))
      return;
    this.busy.set(true);
    this.error.set("");
    try {
      await this.api.patch("/admin/users/" + u.id + "/status", {
        active: !u.active,
      });
      await this.load(this.result()!.page);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
@Component({
  standalone: true,
  imports: UI,
  template: `<div class="page-heading">
      <div>
        <span class="eyebrow">A COMMUNITY BUILT ON TRUST</span>
        <h1>{{ admin ? "Review community reports." : "Your reports." }}</h1>
        <p class="muted">
          {{
            admin
              ? "Review concerns and record a clear resolution."
              : "Raise a concern about a job, company, or user."
          }}
        </p>
      </div>
    </div>
    @if (busy()) {
      <mat-progress-bar mode="indeterminate" />
    }
    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }
    @if (!admin) {
      <section class="card">
        <h2>Report a concern</h2>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="form-grid">
            <mat-form-field appearance="outline"
              ><mat-label>Content type</mat-label
              ><mat-select formControlName="targetType"
                ><mat-option value="JOB">Job</mat-option
                ><mat-option value="COMPANY">Company</mat-option
                ><mat-option value="USER">User</mat-option></mat-select
              ></mat-form-field
            ><mat-form-field appearance="outline"
              ><mat-label>Content ID</mat-label
              ><input
                matInput
                type="number"
                formControlName="targetId"
              /><mat-hint
                >The numeric ID of the content you are reporting.</mat-hint
              ><mat-error
                >Enter a positive whole number.</mat-error
              ></mat-form-field
            ><mat-form-field appearance="outline" class="wide"
              ><mat-label>What happened?</mat-label
              ><textarea matInput formControlName="reason" rows="3"></textarea
              ><mat-error
                >Describe the concern in up to 2,000 characters.</mat-error
              ></mat-form-field
            >
          </div>
          <button mat-flat-button [disabled]="busy()">Submit report</button>
        </form>
      </section>
    }
    <section class="card">
      @for (r of result()?.content; track r.id) {
        <article class="application-row">
          <div class="section-title">
            <h3>{{ r.targetType }} #{{ r.targetId }}</h3>
            <span class="pill">{{ r.status }}</span>
          </div>
          <p class="preserve">{{ r.reason }}</p>
          @if (r.resolution) {
            <p><strong>Resolution:</strong> {{ r.resolution }}</p>
          }
          @if (admin && r.status === "OPEN") {
            <button
              mat-stroked-button
              (click)="selected.set(r.id)"
              [disabled]="busy()"
            >
              Resolve report
            </button>
          }
        </article>
      } @empty {
        <div class="empty">
          <h2>Nothing to review.</h2>
          <p>Reports will appear here when submitted.</p>
        </div>
      }
    </section>
    @if (result(); as r) {
      <div class="pagination">
        <button
          mat-button
          [disabled]="busy() || r.first"
          (click)="load(r.page - 1)"
        >
          Previous</button
        ><span>{{ r.totalElements }} reports</span
        ><button
          mat-button
          [disabled]="busy() || r.last"
          (click)="load(r.page + 1)"
        >
          Next
        </button>
      </div>
    }
    @if (selected()) {
      <section class="card">
        <h2>Resolve report #{{ selected() }}</h2>
        <form [formGroup]="resolution" (ngSubmit)="resolve()">
          <mat-form-field appearance="outline"
            ><mat-label>Outcome</mat-label
            ><mat-select formControlName="status"
              ><mat-option value="REVIEWED">Reviewed</mat-option
              ><mat-option value="DISMISSED">Dismissed</mat-option></mat-select
            ></mat-form-field
          ><mat-form-field appearance="outline"
            ><mat-label>Resolution notes</mat-label
            ><textarea matInput formControlName="resolution" rows="3"></textarea
            ><mat-error
              >Provide a resolution in up to 2,000 characters.</mat-error
            ></mat-form-field
          >
          <div class="actions">
            <button mat-flat-button [disabled]="busy()">Save resolution</button
            ><button mat-button type="button" (click)="selected.set(null)">
              Cancel
            </button>
          </div>
        </form>
      </section>
    }`,
})
export class ReportsPage {
  private api = inject(Api);
  admin = inject(ActivatedRoute).snapshot.data["admin"] === true;
  result = signal<Page<Report> | null>(null);
  busy = signal(false);
  error = signal("");
  selected = signal<number | null>(null);
  private fb = inject(FormBuilder);
  form = this.fb.group({
    targetType: ["JOB", Validators.required],
    targetId: [
      null as number | null,
      [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)],
    ],
    reason: ["", [Validators.required, Validators.maxLength(2000)]],
  });
  resolution = this.fb.nonNullable.group({
    status: ["REVIEWED", Validators.required],
    resolution: ["", [Validators.required, Validators.maxLength(2000)]],
  });
  constructor() {
    void this.load(0);
  }
  async load(page: number) {
    this.busy.set(true);
    this.error.set("");
    try {
      this.result.set(
        await this.api.get(this.admin ? "/admin/reports" : "/reports/me", {
          page,
          size: 20,
        }),
      );
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.error.set("");
    try {
      await this.api.post("/reports", this.form.getRawValue());
      this.form.reset({ targetType: "JOB" });
      await this.load(0);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async resolve() {
    if (this.resolution.invalid) {
      this.resolution.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.error.set("");
    try {
      await this.api.patch(
        "/admin/reports/" + this.selected(),
        this.resolution.getRawValue(),
      );
      this.selected.set(null);
      this.resolution.reset({ status: "REVIEWED" });
      await this.load(this.result()!.page);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
