import { Component, inject, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import {
  Api,
  Application,
  Auth,
  SavedJob,
  Profile,
  errorMessage,
} from "./core";
import { UI } from "./ui";
export function nextStatuses(status: string): string[] {
  const transitions: Record<string, string[]> = {
    APPLIED: ["SHORTLISTED", "REJECTED"],
    SHORTLISTED: ["INTERVIEW", "REJECTED"],
    INTERVIEW: ["OFFERED", "REJECTED"],
    OFFERED: ["HIRED", "REJECTED"],
  };
  return transitions[status] || [];
}
@Component({
  standalone: true,
  imports: UI,
  template: `<div class="page-heading">
      <div>
        <span class="eyebrow">KEEP THINGS MOVING</span>
        <h1>
          {{
            saved
              ? "Saved for a little later."
              : employer
                ? "Meet your applicants."
                : "Every application, one place."
          }}
        </h1>
        <p class="muted">
          {{
            saved
              ? "Opportunities worth coming back to."
              : "Follow the next steps in your hiring journey."
          }}
        </p>
      </div>
    </div>
    @if (busy()) {
      <mat-progress-bar mode="indeterminate" />
    }
    @if (error()) {
      <p class="error" role="alert">
        {{ error() }} <button mat-button (click)="load()">Retry</button>
      </p>
    }
    <section class="card">
      @if (saved) {
        @for (j of savedJobs(); track j.id) {
          <div class="list-row">
            <div>
              <h2>
                <a [routerLink]="['/jobs', j.jobId]">{{ j.jobTitle }}</a>
              </h2>
              <p class="muted">{{ j.companyName }} · {{ j.location }}</p>
            </div>
            <button mat-button (click)="unsave(j)" [disabled]="busy()">
              Remove
            </button>
          </div>
        } @empty {
          <div class="empty">
            <h2>Keep a few possibilities close.</h2>
            <p>Save jobs as you explore, and find them here.</p>
            <a mat-button routerLink="/jobs">Explore jobs →</a>
          </div>
        }
      } @else {
        @for (a of applications(); track a.id) {
          <article class="application-row">
            <div class="section-title">
              <h2>
                <a [routerLink]="['/jobs', a.jobId]">{{
                  titles()[a.jobId] || "Job #" + a.jobId
                }}</a>
              </h2>
              <span class="pill">{{ a.status }}</span>
            </div>
            <p class="muted">
              Applied {{ a.appliedAt | date: "mediumDate" }}
              @if (employer) {
                · Candidate #{{ a.jobSeekerId }}
              }
            </p>
            @if (a.coverLetter) {
              <p class="preserve">{{ a.coverLetter }}</p>
            }
            <div class="actions">
              @if (employer) {
                <button
                  mat-stroked-button
                  (click)="viewCandidate(a.jobSeekerId)"
                  [disabled]="busy()"
                >
                  View candidate</button
                ><button
                  mat-button
                  (click)="download(a.jobSeekerId)"
                  [disabled]="busy()"
                >
                  Download resume
                </button>
                @for (s of transitions(a.status); track s) {
                  <button mat-button (click)="update(a, s)" [disabled]="busy()">
                    {{
                      s === "REJECTED" ? "Reject" : "Move to " + s.toLowerCase()
                    }}
                  </button>
                }
              } @else {
                <button mat-button (click)="withdraw(a)" [disabled]="busy()">
                  Withdraw application
                </button>
              }
            </div>
          </article>
        } @empty {
          <div class="empty">
            <h2>No applications yet.</h2>
            <p>
              {{
                employer
                  ? "Applications for this job will appear here."
                  : "Find a role that feels right, and take the first step."
              }}
            </p>
            @if (!employer) {
              <a mat-button routerLink="/jobs">Explore jobs →</a>
            }
          </div>
        }
      }
    </section>
    @if (candidate(); as c) {
      <section class="card">
        <div class="section-title">
          <h2>{{ c.firstName }} {{ c.lastName }}</h2>
          <button mat-button (click)="candidate.set(null)">
            Close profile
          </button>
        </div>
        <p>{{ c.headline }}</p>
        <p class="muted">{{ c.email }} · {{ c.location }}</p>
        <p class="preserve">{{ c.summary }}</p>
        <div class="tags">
          @for (s of c.skills; track s.id) {
            <span>{{ s.name }}</span>
          }
        </div>
        @for (
          section of ["education", "experience", "projects", "certifications"];
          track section
        ) {
          <h3>{{ section | titlecase }}</h3>
          @for (item of candidateItems(c, section); track $index) {
            <p>
              {{ item["name"] || item["degree"] || item["jobTitle"] }} ·
              {{ item["institution"] || item["companyName"] || item["issuer"]
              }}<br /><span class="muted">{{ item["description"] }}</span>
            </p>
          }
        }
      </section>
    }`,
})
export class ActivityPage {
  private api = inject(Api);
  private auth = inject(Auth);
  private route = inject(ActivatedRoute);
  saved = this.route.snapshot.data["saved"] === true;
  employer = !!this.route.snapshot.paramMap.get("jobId");
  jobId = Number(this.route.snapshot.paramMap.get("jobId"));
  busy = signal(false);
  error = signal("");
  applications = signal<Application[]>([]);
  savedJobs = signal<SavedJob[]>([]);
  titles = signal<Record<number, string>>({});
  candidate = signal<Profile | null>(null);
  transitions = nextStatuses;
  constructor() {
    void this.load();
  }
  async load() {
    await this.run(async () => {
      if (this.saved)
        this.savedJobs.set(
          await this.api.get(
            "/saved-jobs/job-seeker/" + this.auth.user()!.profileId,
          ),
        );
      else {
        const list = await this.api.get<Application[]>(
          "/job-applications/" +
            (this.employer
              ? "job/" + this.jobId
              : "job-seeker/" + this.auth.user()!.profileId),
        );
        this.applications.set(list);
        const ids = [...new Set(list.map((a) => a.jobId))];
        const results = await Promise.allSettled(
          ids.map((id) => this.api.get<{ title: string }>("/jobs/" + id)),
        );
        const titles: Record<number, string> = {};
        results.forEach((r, i) => {
          if (r.status === "fulfilled") titles[ids[i]] = r.value.title;
        });
        this.titles.set(titles);
      }
    });
  }
  async run(fn: () => Promise<void>) {
    this.busy.set(true);
    this.error.set("");
    try {
      await fn();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async unsave(j: SavedJob) {
    await this.run(async () => {
      await this.api.delete(
        "/saved-jobs/job/" +
          j.jobId +
          "/job-seeker/" +
          this.auth.user()!.profileId,
      );
      this.savedJobs.update((v) => v.filter((x) => x.id !== j.id));
    });
  }
  async withdraw(a: Application) {
    if (!confirm("Withdraw this application?")) return;
    await this.run(async () => {
      await this.api.delete("/job-applications/" + a.id);
      this.applications.update((v) => v.filter((x) => x.id !== a.id));
    });
  }
  async update(a: Application, status: string) {
    if (!confirm("Move this application to " + status + "?")) return;
    await this.run(async () => {
      const updated = await this.api.patch<Application>(
        "/job-applications/" + a.id + "/status",
        {},
        { status },
      );
      this.applications.update((v) =>
        v.map((x) => (x.id === a.id ? updated : x)),
      );
    });
  }
  viewCandidate(id: number) {
    return this.run(async () => {
      this.candidate.set(await this.api.get("/job-seekers/" + id));
    });
  }
  download(id: number) {
    return this.run(() => this.api.download("/job-seekers/" + id + "/resume"));
  }
  candidateItems(c: Profile, key: string) {
    return c[key as keyof Profile] as Record<string, unknown>[];
  }
}
