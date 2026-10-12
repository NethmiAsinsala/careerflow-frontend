import { Component, inject, signal } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { HttpErrorResponse } from "@angular/common/http";
import { Api, Auth, Company, Job, errorMessage } from "./core";
import { UI } from "./ui";
@Component({
  standalone: true,
  imports: UI,
  template: `<div class="page-heading">
      <div>
        <span class="eyebrow">GOOD PEOPLE. MEANINGFUL WORK.</span>
        <h1>Your opportunities.</h1>
        <p class="muted">Create roles that help the right people find you.</p>
      </div>
      <button mat-flat-button (click)="edit()" [disabled]="busy()">
        + Create a job
      </button>
    </div>
    @if (busy()) {
      <mat-progress-bar mode="indeterminate" />
    }
    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }
    @if (editing()) {
      <section class="card">
        <h2>{{ editId ? "Edit opportunity" : "Create an opportunity" }}</h2>
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="form-grid">
            @for (f of fields; track f.key) {
              <mat-form-field appearance="outline"
                ><mat-label>{{ f.label }}</mat-label>
                @if (f.key === "description") {
                  <textarea
                    matInput
                    [formControlName]="f.key"
                    rows="5"
                  ></textarea>
                } @else {
                  <input
                    matInput
                    [formControlName]="f.key"
                    [type]="f.type || 'text'"
                  />
                }
                <mat-error>Check this field.</mat-error></mat-form-field
              >
            }
            <mat-form-field appearance="outline"
              ><mat-label>Status</mat-label
              ><mat-select formControlName="status"
                ><mat-option value="OPEN">Open</mat-option
                ><mat-option value="CLOSED">Closed</mat-option></mat-select
              ></mat-form-field
            >
          </div>
          <div class="actions">
            <button mat-flat-button [disabled]="busy()">Save job</button
            ><button
              mat-button
              type="button"
              (click)="editing.set(false)"
              [disabled]="busy()"
            >
              Cancel
            </button>
          </div>
        </form>
      </section>
    }
    <section class="card">
      @for (j of jobs(); track j.id) {
        <article class="application-row">
          <div class="section-title">
            <h2>{{ j.title }}</h2>
            <span class="pill">{{ j.status }}</span>
          </div>
          <p class="muted">{{ j.location }} · {{ j.employmentType }}</p>
          <div class="actions">
            <a
              mat-stroked-button
              [routerLink]="['/manage-jobs', j.id, 'applicants']"
              >View applicants</a
            ><button mat-button (click)="edit(j)" [disabled]="busy()">
              Edit</button
            ><button mat-button (click)="remove(j)" [disabled]="busy()">
              Delete
            </button>
          </div>
        </article>
      } @empty {
        <div class="empty">
          <h2>A new opportunity starts with you.</h2>
          <p>Create your first job to start meeting candidates.</p>
        </div>
      }
    </section>`,
})
export class EmployerPage {
  private api = inject(Api);
  private auth = inject(Auth);
  jobs = signal<Job[]>([]);
  busy = signal(false);
  error = signal("");
  editing = signal(false);
  editId: number | null = null;
  fields = [
    { key: "title", label: "Job title", type: "text" },
    { key: "location", label: "Location", type: "text" },
    {
      key: "employmentType",
      label: "Employment type (e.g. Full-time)",
      type: "text",
    },
    { key: "experienceLevel", label: "Experience level", type: "text" },
    { key: "salaryMin", label: "Minimum salary", type: "number" },
    { key: "salaryMax", label: "Maximum salary", type: "number" },
    { key: "skills", label: "Required skills (comma-separated)", type: "text" },
    {
      key: "applicationDeadline",
      label: "Application deadline",
      type: "datetime-local",
    },
    { key: "description", label: "Job description", type: "text" },
  ];
  form = inject(FormBuilder).group({
    title: ["", [Validators.required, Validators.maxLength(255)]],
    location: ["", Validators.maxLength(255)],
    employmentType: ["", Validators.maxLength(100)],
    experienceLevel: ["", Validators.maxLength(100)],
    salaryMin: [null as number | null, Validators.min(0)],
    salaryMax: [null as number | null, Validators.min(0)],
    skills: [""],
    applicationDeadline: [""],
    description: [""],
    status: ["OPEN"],
  });
  constructor() {
    void this.load();
  }
  async load() {
    this.busy.set(true);
    try {
      this.jobs.set(
        await this.api.get("/jobs/employer/" + this.auth.user()!.profileId),
      );
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  edit(j?: Job) {
    this.error.set("");
    this.editId = j?.id ?? null;
    this.form.reset({ status: "OPEN" });
    if (j)
      this.form.patchValue({
        ...j,
        applicationDeadline: j.applicationDeadline?.slice(0, 16) || "",
      });
    this.editing.set(true);
  }
  async save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    if (
      v.salaryMin !== null &&
      v.salaryMax !== null &&
      v.salaryMin > v.salaryMax
    ) {
      this.error.set("Maximum salary must be at least the minimum salary.");
      return;
    }
    this.busy.set(true);
    this.error.set("");
    try {
      const body = {
        ...v,
        applicationDeadline: v.applicationDeadline
          ? v.applicationDeadline + ":00"
          : null,
      };
      if (this.editId) await this.api.put("/jobs/" + this.editId, body);
      else
        await this.api.post(
          "/jobs/employer/" + this.auth.user()!.profileId,
          body,
        );
      this.editing.set(false);
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async remove(j: Job) {
    if (!confirm("Delete " + j.title + "? This may remove related records."))
      return;
    this.busy.set(true);
    this.error.set("");
    try {
      await this.api.delete("/jobs/" + j.id);
      this.jobs.update((v) => v.filter((x) => x.id !== j.id));
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
        <span class="eyebrow">INTRODUCE YOUR TEAM</span>
        <h1>A company worth knowing.</h1>
        <p class="muted">
          Tell candidates about the place they could call work.
        </p>
      </div>
    </div>
    @if (busy()) {
      <mat-progress-bar mode="indeterminate" />
    }
    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }
    @if (message()) {
      <p class="notice" role="status">{{ message() }}</p>
    }
    @if (loaded()) {
      <section class="card">
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="form-grid">
            @for (f of fields; track f.key) {
              <mat-form-field appearance="outline"
                ><mat-label>{{ f.label }}</mat-label>
                @if (f.key === "description") {
                  <textarea
                    matInput
                    [formControlName]="f.key"
                    rows="5"
                  ></textarea>
                } @else {
                  <input matInput [formControlName]="f.key" />
                }
                <mat-error>Enter a valid value.</mat-error></mat-form-field
              >
            }
          </div>
          <button mat-flat-button [disabled]="busy()">
            Save company profile
          </button>
        </form>
      </section>
    }`,
})
export class CompanyPage {
  private api = inject(Api);
  private auth = inject(Auth);
  busy = signal(false);
  loaded = signal(false);
  error = signal("");
  message = signal("");
  id: number | null = null;
  fields = [
    { key: "name", label: "Company name" },
    { key: "industry", label: "Industry" },
    { key: "location", label: "Location" },
    { key: "website", label: "Website URL" },
    { key: "logoUrl", label: "Logo URL" },
    { key: "description", label: "About the company" },
  ];
  form = inject(FormBuilder).nonNullable.group({
    name: ["", Validators.required],
    industry: [""],
    location: [""],
    website: ["", Validators.pattern(/^https?:\/\/.+/)],
    logoUrl: ["", Validators.pattern(/^https?:\/\/.+/)],
    description: [""],
  });
  constructor() {
    void this.load();
  }
  async load() {
    this.busy.set(true);
    try {
      const c = await this.api.get<Company>(
        "/companies/employer/" + this.auth.user()!.profileId,
      );
      this.id = c.id;
      this.form.patchValue(c);
      this.loaded.set(true);
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 404)
        this.loaded.set(true);
      else this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.error.set("");
    try {
      const c = await (this.id
        ? this.api.put<Company>(
            "/companies/" + this.id,
            this.form.getRawValue(),
          )
        : this.api.post<Company>(
            "/companies/employer/" + this.auth.user()!.profileId,
            this.form.getRawValue(),
          ));
      this.id = c.id;
      this.auth.refreshIdentity();
      this.message.set("Company profile saved.");
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
