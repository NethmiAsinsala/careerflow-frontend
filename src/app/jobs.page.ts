import { Component, inject, signal } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { Api, Auth, Job, Page, errorMessage } from "./core";
import { UI } from "./ui";
@Component({
  standalone: true,
  imports: UI,
  template: ` <div class="page-heading">
      <div>
        <span class="eyebrow">ROOM TO GROW</span>
        <h1>Find your next chapter.</h1>
        <p class="muted">
          Explore opportunities that fit the work you want to do.
        </p>
      </div>
    </div>
    <form class="filter-bar card" [formGroup]="filters" (ngSubmit)="load(0)">
      <mat-form-field appearance="outline"
        ><mat-label>Title or keyword</mat-label
        ><input matInput formControlName="keyword" /></mat-form-field
      ><mat-form-field appearance="outline"
        ><mat-label>Location</mat-label
        ><input matInput formControlName="location" /></mat-form-field
      ><mat-form-field appearance="outline"
        ><mat-label>Skill</mat-label
        ><input matInput formControlName="skill" /></mat-form-field
      ><button mat-flat-button type="submit" [disabled]="busy()">
        Find jobs
      </button>
    </form>
    @if (busy()) {
      <mat-progress-bar mode="indeterminate" />
    }
    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }
    <div class="section-title">
      <h2>Open opportunities</h2>
      <span class="muted">{{ result()?.totalElements ?? 0 }} results</span>
    </div>
    <div class="job-grid">
      @for (job of result()?.content; track job.id) {
        <article class="card job-card">
          <div class="job-mark" aria-hidden="true">
            {{ job.title.slice(0, 1) }}
          </div>
          <span class="pill">{{ job.employmentType || "Opportunity" }}</span>
          <h2>
            <a [routerLink]="['/jobs', job.id]">{{ job.title }}</a>
          </h2>
          <p class="muted">
            {{ job.location || "Location not specified" }} ·
            {{ job.experienceLevel || "All experience levels" }}
          </p>
          <p class="job-excerpt">
            {{ job.description || "View this role for more details." }}
          </p>
          <div class="tags">
            @for (skill of skills(job.skills).slice(0, 4); track $index) {
              <span>{{ skill }}</span>
            }
          </div>
          <a mat-button [routerLink]="['/jobs', job.id]">Explore role ↗</a>
        </article>
      } @empty {
        @if (!busy()) {
          <div class="empty card">
            <h2>A fresh search might help.</h2>
            <p>
              There are no jobs matching these filters. Try a broader keyword or
              location.
            </p>
          </div>
        }
      }
    </div>
    @if (result(); as r) {
      <div class="pagination">
        <button
          mat-button
          [disabled]="busy() || r.first"
          (click)="load(r.page - 1)"
        >
          ← Previous</button
        ><span
          >Page {{ r.totalPages ? r.page + 1 : 0 }} of {{ r.totalPages }}</span
        ><button
          mat-button
          [disabled]="busy() || r.last"
          (click)="load(r.page + 1)"
        >
          Next →
        </button>
      </div>
    }`,
})
export class JobsPage {
  private api = inject(Api);
  filters = inject(FormBuilder).nonNullable.group({
    keyword: [""],
    location: [""],
    skill: [""],
  });
  result = signal<Page<Job> | null>(null);
  busy = signal(false);
  error = signal("");
  private generation = 0;
  constructor() {
    void this.load(0);
  }
  skills(s: string) {
    return (s || "")
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  async load(page: number) {
    const generation = ++this.generation;
    this.busy.set(true);
    this.error.set("");
    try {
      const result = await this.api.get<Page<Job>>("/jobs", {
        ...this.filters.getRawValue(),
        page,
        size: 9,
        availableOnly: true,
      });
      if (generation === this.generation) this.result.set(result);
    } catch (e) {
      if (generation === this.generation) this.error.set(errorMessage(e));
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
}
@Component({
  standalone: true,
  imports: UI,
  template: `<a class="back-link" routerLink="/jobs">← All opportunities</a>
    @if (busy()) {
      <mat-progress-bar mode="indeterminate" />
    }
    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }
    @if (message()) {
      <p class="notice" role="status">{{ message() }}</p>
    }
    @if (job(); as j) {
      <div class="page-heading">
        <div>
          <span class="eyebrow">YOUR NEXT OPPORTUNITY</span>
          <h1>{{ j.title }}</h1>
          <p class="muted">
            {{ j.location || "Location not specified" }} ·
            {{ j.employmentType }} · {{ j.experienceLevel }}
          </p>
        </div>
        <span class="pill">{{ j.status }}</span>
      </div>
      <div class="two-column">
        <article class="card">
          <h2>About this role</h2>
          <p class="preserve">
            {{ j.description || "No description provided." }}
          </p>
          <h3>Skills</h3>
          <p>{{ j.skills || "No skills specified." }}</p>
          @if (j.salaryMin !== null || j.salaryMax !== null) {
            <h3>Salary range</h3>
            <p>
              {{ j.salaryMin ?? "Not specified" }} –
              {{ j.salaryMax ?? "Not specified" }}
              <small>(currency not provided by employer)</small>
            </p>
          }
          <p class="muted">
            Deadline:
            {{
              j.applicationDeadline
                ? (j.applicationDeadline | date: "medium")
                : "No deadline listed"
            }}
          </p>
        </article>
        <aside class="card">
          <h2>Make your next move.</h2>
          @if (auth.user()?.role === "JOB_SEEKER") {
            @if (match(); as m) {
              <p class="match">
                {{
                  m.matchPercentage === null
                    ? "No score available"
                    : m.matchPercentage + "% skill match"
                }}
              </p>
              <p class="muted">{{ m.note }}</p>
              @if (m.missingSkills.length) {
                <p>Skills to develop: {{ m.missingSkills.join(", ") }}</p>
              }
            }
            <p>
              <a
                mat-stroked-button
                routerLink="/resume"
                [queryParams]="{ jobId: j.id }"
                >Compare my CV with this job</a
              >
            </p>
            <form [formGroup]="form" (ngSubmit)="apply()">
              <mat-form-field appearance="outline"
                ><mat-label>Cover letter (optional)</mat-label
                ><textarea
                  matInput
                  rows="5"
                  formControlName="coverLetter"
                ></textarea></mat-form-field
              ><button
                mat-flat-button
                type="submit"
                [disabled]="acting() || applied() || !available(j)"
              >
                {{ applied() ? "Application sent" : "Apply for this role" }}
              </button>
            </form>
            <button
              mat-stroked-button
              (click)="save()"
              [disabled]="acting() || saved()"
            >
              {{ saved() ? "Saved" : "Save for later" }}
            </button>
            @if (!available(j)) {
              <p class="muted">
                This role is no longer accepting applications.
              </p>
            }
          } @else if (!auth.user()) {
            <p>Sign in as a candidate to apply and save this role.</p>
            <a
              mat-flat-button
              routerLink="/login"
              [queryParams]="{ returnUrl: '/jobs/' + j.id }"
              >Sign in to apply</a
            >
          } @else {
            <p>Applications are available from a candidate account.</p>
          }
        </aside>
      </div>
    }`,
})
export class JobDetailPage {
  private api = inject(Api);
  auth = inject(Auth);
  private id = Number(inject(ActivatedRoute).snapshot.paramMap.get("id"));
  job = signal<Job | null>(null);
  busy = signal(true);
  acting = signal(false);
  error = signal("");
  message = signal("");
  applied = signal(false);
  saved = signal(false);
  match = signal<{
    matchPercentage: number | null;
    note: string;
    missingSkills: string[];
  } | null>(null);
  form = inject(FormBuilder).nonNullable.group({ coverLetter: [""] });
  constructor() {
    void this.load();
  }
  available(j: Job) {
    return (
      j.status === "OPEN" &&
      (!j.applicationDeadline ||
        new Date(j.applicationDeadline).getTime() > Date.now())
    );
  }
  async load() {
    try {
      this.job.set(await this.api.get<Job>("/jobs/" + this.id));
      await this.auth.restore();
      if (this.auth.user()?.role === "JOB_SEEKER") {
        try {
          this.match.set(await this.api.get("/jobs/" + this.id + "/match"));
        } catch {
          /* Match is supplementary; keep the job visible. */
        }
      }
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async apply() {
    await this.action(async () => {
      await this.api.post(
        "/job-applications/job/" +
          this.id +
          "/job-seeker/" +
          this.auth.user()!.profileId,
        this.form.getRawValue(),
      );
      this.applied.set(true);
      this.message.set(
        "Application sent. Follow its progress in My applications.",
      );
    });
  }
  async save() {
    await this.action(async () => {
      await this.api.post("/saved-jobs", {
        jobId: this.id,
        jobSeekerId: this.auth.user()!.profileId,
      });
      this.saved.set(true);
      this.message.set("Added to your saved jobs.");
    });
  }
  private async action(fn: () => Promise<void>) {
    this.acting.set(true);
    this.error.set("");
    try {
      await fn();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.acting.set(false);
    }
  }
}
