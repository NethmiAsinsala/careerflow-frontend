import { Component, inject, signal } from "@angular/core";
import { Api, Analysis, JobAnalysis, Job, Page, errorMessage } from "./core";
import { ActivatedRoute } from "@angular/router";
import { FormControl } from "@angular/forms";
import { UI } from "./ui";
@Component({
  standalone: true,
  imports: UI,
  template: `<div class="page-heading">
      <div>
        <span class="eyebrow">MAKE YOUR EXPERIENCE SHINE</span>
        <h1>Resume studio.</h1>
        <p class="muted">Your experience, thoughtfully presented.</p>
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
    <div class="two-column">
      <section class="card">
        <h2>A good story starts here.</h2>
        <p>
          Upload a text-based PDF, up to 5 MB. Uploading replaces your previous
          resume.
        </p>
        <label class="upload"
          ><strong>Choose your resume</strong><span>PDF · Maximum 5 MB</span
          ><input
            type="file"
            accept="application/pdf,.pdf"
            (change)="choose($event)"
            [disabled]="busy()"
        /></label>
        <div class="actions">
          <button mat-stroked-button (click)="download()" [disabled]="busy()">
            Download current PDF</button
          ><button mat-button (click)="remove()" [disabled]="busy()">
            Delete resume
          </button>
        </div>
      </section>
      <aside class="card accent-card">
        <span class="eyebrow">A FRESH PERSPECTIVE</span>
        <h2>Turn experience into impact.</h2>
        <p>
          Get suggestions on your resume’s clarity, skills, and strengths using
          your local Ollama model.
        </p>
        <mat-form-field appearance="outline">
          <mat-label>Job to compare (optional)</mat-label>
          <mat-select [formControl]="selectedJob" [disabled]="busy()">
            <mat-option [value]="null">General resume review</mat-option>
            @for (job of jobs(); track job.id) {
              <mat-option [value]="job.id"
                >{{ job.title }} — {{ job.location }}</mat-option
              >
            }
          </mat-select>
        </mat-form-field>
        @if (jobError()) {
          <p class="error" role="alert">{{ jobError() }}</p>
        }
        @if (hasMore()) {
          <button
            mat-button
            (click)="loadJobs()"
            [disabled]="loadingJobs() || busy()"
          >
            Load more jobs
          </button>
        }
        <button mat-flat-button (click)="analyze()" [disabled]="busy()">
          {{
            analyzing()
              ? "Reviewing your resume…"
              : selectedJob.value
                ? "Compare CV with job ↗"
                : "Analyze my resume ↗"
          }}
        </button>
        <p class="muted">
          Ollama must be running. Analysis may take several minutes. Suggestions
          do not change your profile automatically.
        </p>
      </aside>
    </div>
    @if (comparison(); as c) {
      <section class="card" aria-live="polite">
        <span class="eyebrow">CV COMPARED WITH JOB</span>
        <h2>{{ c.jobTitle }}</h2>
        <p class="match">
          {{
            c.percentage === null
              ? "Not scored — no listed skills"
              : c.percentage + "% CV skill coverage"
          }}
        </p>
        <p>
          {{ c.matchedSkills.length }} of {{ c.requiredCount }} listed skills
          found in your CV.
        </p>
        <p class="muted">{{ c.explanation }}</p>
        <h3>Matching skills</h3>
        <p>{{ c.matchedSkills.join(", ") || "No listed skills matched." }}</p>
        <h3>Skills not evidenced in your CV</h3>
        <p>{{ c.missingSkills.join(", ") || "No listed skill gaps." }}</p>
        <p class="muted">
          If you have these skills, add truthful project or work examples.
          Otherwise, use them to plan your learning.
        </p>
      </section>
    }
    @if (analysis(); as a) {
      <section class="card">
        <span class="eyebrow">YOUR RESUME REVIEW</span>
        <h2>A clearer way forward.</h2>
        <p class="preserve">{{ a.feedback.summary }}</p>
        <div class="two-column">
          <div>
            <h3>What’s working</h3>
            <ul>
              @for (s of a.feedback.strengths; track $index) {
                <li>{{ s }}</li>
              }
            </ul>
          </div>
          <div>
            <h3>Ways to improve</h3>
            <ul>
              @for (s of a.feedback.improvements; track $index) {
                <li>{{ s }}</li>
              }
            </ul>
          </div>
        </div>
        <h3>Skills found</h3>
        <div class="tags">
          @for (s of a.feedback.skills; track $index) {
            <span>{{ s }}</span>
          }
        </div>
        <p class="muted">{{ a.note }} · Model: {{ a.model }}</p>
      </section>
    }`,
})
export class ResumePage {
  private api = inject(Api);
  private route = inject(ActivatedRoute);
  selectedJob = new FormControl<number | null>(null);
  jobs = signal<Job[]>([]);
  comparison = signal<JobAnalysis["comparison"] | null>(null);
  jobError = signal("");
  loadingJobs = signal(false);
  hasMore = signal(true);
  private page = 0;
  constructor() {
    void this.initializeJobs();
  }
  private async initializeJobs() {
    const id = Number(this.route.snapshot.queryParamMap.get("jobId"));
    if (Number.isSafeInteger(id) && id > 0) {
      try {
        const job = await this.api.get<Job>("/jobs/" + id);
        this.jobs.set([job]);
        this.selectedJob.setValue(job.id);
      } catch (e) {
        this.jobError.set(errorMessage(e));
      }
    }
    await this.loadJobs();
  }
  async loadJobs() {
    if (this.loadingJobs()) return;
    this.loadingJobs.set(true);
    try {
      const page = await this.api.get<Page<Job>>("/jobs", {
        page: this.page,
        size: 20,
        availableOnly: true,
      });
      this.jobs.update((existing) => [
        ...new Map(
          [...existing, ...page.content].map((job) => [job.id, job]),
        ).values(),
      ]);
      this.page++;
      this.hasMore.set(!page.last);
    } catch (e) {
      this.jobError.set(errorMessage(e));
    } finally {
      this.loadingJobs.set(false);
    }
  }
  busy = signal(false);
  analyzing = signal(false);
  error = signal("");
  message = signal("");
  analysis = signal<Analysis | null>(null);
  async action(fn: () => Promise<void>) {
    this.busy.set(true);
    this.error.set("");
    this.message.set("");
    try {
      await fn();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
      this.analyzing.set(false);
    }
  }
  async choose(event: Event) {
    const input = event.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf") || f.size > 5 * 1024 * 1024) {
      this.error.set("Choose a PDF no larger than 5 MB.");
      input.value = "";
      return;
    }
    await this.action(async () => {
      const form = new FormData();
      form.append("file", f);
      await this.api.post("/job-seekers/me/resume", form);
      this.analysis.set(null);
      this.comparison.set(null);
      this.message.set("Your resume has been uploaded.");
    });
    input.value = "";
  }
  download() {
    return this.action(() => this.api.download("/job-seekers/me/resume"));
  }
  async remove() {
    if (!confirm("Delete your current resume?")) return;
    await this.action(async () => {
      await this.api.delete("/job-seekers/me/resume");
      this.analysis.set(null);
      this.comparison.set(null);
      this.message.set("Resume deleted.");
    });
  }
  analyze() {
    this.analyzing.set(true);
    return this.action(async () => {
      this.analysis.set(null);
      this.comparison.set(null);
      const id = this.selectedJob.value;
      if (id) {
        const result = await this.api.post<JobAnalysis>(
          "/ai/resume/compare/" + id,
        );
        this.analysis.set(result.analysis);
        this.comparison.set(result.comparison);
      } else
        this.analysis.set(await this.api.post<Analysis>("/ai/resume/analyze"));
    });
  }
}
