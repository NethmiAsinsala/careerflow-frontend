import { Component, inject, signal } from "@angular/core";
import { Api, Analysis, errorMessage } from "./core";
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
        <button mat-flat-button (click)="analyze()" [disabled]="busy()">
          {{ analyzing() ? "Reviewing your resume…" : "Analyze my resume ↗" }}
        </button>
        <p class="muted">
          Ollama must be running. Analysis may take up to two minutes.
          Suggestions do not change your profile automatically.
        </p>
      </aside>
    </div>
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
      this.message.set("Resume deleted.");
    });
  }
  analyze() {
    this.analyzing.set(true);
    return this.action(async () => {
      this.analysis.set(await this.api.post<Analysis>("/ai/resume/analyze"));
    });
  }
}
