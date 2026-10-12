import { Component, inject, signal } from "@angular/core";
import { Api, Auth, Recommendation, errorMessage } from "./core";
import { UI } from "./ui";
@Component({
  standalone: true,
  imports: UI,
  template: `<div class="page-heading">
      <div>
        <span class="eyebrow">A LITTLE PROGRESS, EVERY DAY</span>
        <h1>Your next chapter starts here.</h1>
        <p class="muted">A clear view of where you are, and what comes next.</p>
      </div>
      <a mat-stroked-button routerLink="/jobs">Explore jobs ↗</a>
    </div>
    @if (busy()) {
      <mat-progress-bar mode="indeterminate" />
    }
    @if (error()) {
      <p class="error" role="alert">
        {{ error() }} <button mat-button (click)="load()">Retry</button>
      </p>
    }
    <div class="stats">
      @for (stat of stats(); track stat.label) {
        <article class="card">
          <span class="muted">{{ stat.label }}</span
          ><strong>{{ stat.value }}</strong
          ><small>Your workspace, at a glance</small>
        </article>
      }
    </div>
    <div class="two-column">
      <section class="card">
        <div class="section-title">
          <h2>
            {{
              auth.user()?.role === "JOB_SEEKER"
                ? "A few good possibilities"
                : "Application activity"
            }}
          </h2>
        </div>
        @if (auth.user()?.role === "JOB_SEEKER") {
          @for (r of recommendations(); track r.job.id) {
            <a class="list-row" [routerLink]="['/jobs', r.job.id]"
              ><div>
                <h3>{{ r.job.title }}</h3>
                <p class="muted">
                  {{ r.job.location || "Location not specified" }} ·
                  {{ r.job.employmentType }}
                </p>
              </div>
              <span class="pill">{{ r.matchPercentage }}% skill match</span></a
            >
          } @empty {
            <div class="empty">
              <h3>Make room for the right role.</h3>
              <p>
                {{
                  note() ||
                    "Add your skills to your profile to discover relevant opportunities."
                }}
              </p>
              <a mat-button routerLink="/profile">Build your profile →</a>
            </div>
          }
        } @else {
          @for (s of statuses(); track s.label) {
            <div class="list-row">
              <span>{{ s.label }}</span
              ><strong>{{ s.value }}</strong>
            </div>
          } @empty {
            <p class="muted">Your application activity will appear here.</p>
          }
        }
      </section>
      <aside>
        <section class="card accent-card">
          <span class="eyebrow">YOUR NEXT SMALL STEP</span>
          <h2>
            {{
              auth.user()?.role === "JOB_SEEKER"
                ? "A resume that tells your story."
                : auth.user()?.role === "EMPLOYER"
                  ? "Find your next great teammate."
                  : "Keep the community moving."
            }}
          </h2>
          <p>
            {{
              auth.user()?.role === "JOB_SEEKER"
                ? "Upload your PDF and get private, local AI feedback on how to make it clearer."
                : "Everything you need to manage your workspace, in one place."
            }}
          </p>
          <a
            mat-flat-button
            [routerLink]="
              auth.user()?.role === 'JOB_SEEKER'
                ? '/resume'
                : auth.user()?.role === 'EMPLOYER'
                  ? '/manage-jobs'
                  : '/moderation'
            "
            >{{
              auth.user()?.role === "JOB_SEEKER"
                ? "Visit resume studio"
                : "Open workspace"
            }}
            ↗</a
          >
        </section>
        <section class="card tip">
          <span class="eyebrow">A THOUGHT FOR TODAY</span>
          <p>Small, thoughtful steps can lead to meaningful change.</p>
        </section>
      </aside>
    </div>`,
})
export class DashboardPage {
  private api = inject(Api);
  auth = inject(Auth);
  busy = signal(true);
  error = signal("");
  stats = signal<{ label: string; value: number }[]>([]);
  statuses = signal<{ label: string; value: number }[]>([]);
  recommendations = signal<Recommendation[]>([]);
  note = signal("");
  constructor() {
    void this.load();
  }
  async load() {
    this.busy.set(true);
    this.error.set("");
    try {
      const role = this.auth.user()!.role;
      const d = await this.api.get<
        Record<string, number | Record<string, number>>
      >(
        "/dashboard/" +
          (role === "JOB_SEEKER" ? "candidate" : role.toLowerCase()),
      );
      this.stats.set(
        Object.entries(d)
          .filter(([, v]) => typeof v === "number")
          .map(([k, v]) => ({
            label: k
              .replace(/([A-Z])/g, " $1")
              .replace(/^./, (s) => s.toUpperCase()),
            value: v as number,
          })),
      );
      this.statuses.set(
        Object.entries(
          (d["applicationsByStatus"] as Record<string, number>) || {},
        ).map(([label, value]) => ({ label, value })),
      );
      if (role === "JOB_SEEKER") {
        const r = await this.api.get<{ jobs: Recommendation[]; note: string }>(
          "/job-seekers/me/recommendations",
          { limit: 4 },
        );
        this.recommendations.set(r.jobs);
        this.note.set(r.note);
      }
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
