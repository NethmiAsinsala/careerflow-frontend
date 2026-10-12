import { Component, inject, signal } from "@angular/core";
import {
  FormBuilder,
  FormControl,
  FormGroup,
  Validators,
} from "@angular/forms";
import { Api, Auth, Profile, errorMessage } from "./core";
import { UI } from "./ui";
interface Field {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  max?: number;
}
const sections: Record<string, Field[]> = {
  skills: [{ key: "name", label: "Skill", required: true, max: 100 }],
  education: [
    { key: "institution", label: "Institution", required: true },
    { key: "degree", label: "Degree", required: true },
    { key: "fieldOfStudy", label: "Field of study" },
    { key: "startDate", label: "Start date", type: "date" },
    { key: "endDate", label: "End date", type: "date" },
    { key: "description", label: "Description", max: 10000 },
  ],
  experience: [
    { key: "companyName", label: "Company", required: true },
    { key: "jobTitle", label: "Job title", required: true },
    { key: "startDate", label: "Start date", type: "date" },
    { key: "endDate", label: "End date", type: "date" },
    { key: "description", label: "Description", max: 10000 },
  ],
  projects: [
    { key: "name", label: "Project name", required: true },
    { key: "description", label: "Description", max: 10000 },
    { key: "technologies", label: "Technologies", max: 10000 },
    { key: "projectUrl", label: "Project URL", type: "url", max: 500 },
  ],
  certifications: [
    { key: "name", label: "Certification", required: true, max: 200 },
    { key: "issuer", label: "Issuer", required: true, max: 200 },
    { key: "issuedOn", label: "Issued on", type: "date" },
    { key: "expiresOn", label: "Expires on", type: "date" },
    { key: "credentialUrl", label: "Credential URL", type: "url", max: 500 },
  ],
};
@Component({
  standalone: true,
  imports: UI,
  template: `<div class="page-heading">
      <div>
        <span class="eyebrow">THE STORY ONLY YOU CAN TELL</span>
        <h1>Your professional profile.</h1>
        <p class="muted">Help employers understand the experience you bring.</p>
      </div>
      <a mat-stroked-button routerLink="/resume">Resume studio ↗</a>
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
    @if (profile()) {
      <section class="card">
        <h2>The essentials</h2>
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="form-grid">
            @for (f of personalFields; track f.key) {
              <mat-form-field
                appearance="outline"
                [class.wide]="f.key === 'summary'"
                ><mat-label>{{ f.label }}</mat-label>
                @if (f.key === "summary") {
                  <textarea
                    matInput
                    [formControlName]="f.key"
                    rows="4"
                  ></textarea>
                } @else {
                  <input
                    matInput
                    [formControlName]="f.key"
                    [type]="f.type || 'text'"
                  />
                }
                <mat-error
                  >Enter a valid {{ f.label.toLowerCase() }} (maximum
                  {{ f.max }} characters).</mat-error
                ></mat-form-field
              >
            }
          </div>
          <button mat-flat-button [disabled]="busy()">Save profile</button>
        </form>
      </section>
      <div class="profile-sections">
        @for (section of sectionNames; track section) {
          <section class="card">
            <div class="section-title">
              <h2>{{ section | titlecase }}</h2>
              <button mat-button (click)="edit(section)" [disabled]="busy()">
                + Add
              </button>
            </div>
            @for (item of items(section); track item["id"]) {
              <div class="list-row">
                <div>
                  <h3>
                    {{ item["name"] || item["jobTitle"] || item["degree"] }}
                  </h3>
                  <p class="muted">
                    {{
                      item["institution"] ||
                        item["companyName"] ||
                        item["issuer"] ||
                        item["technologies"]
                    }}
                  </p>
                </div>
                <div class="actions">
                  <button
                    mat-button
                    (click)="edit(section, item)"
                    [disabled]="busy()"
                  >
                    Edit</button
                  ><button
                    mat-button
                    (click)="remove(section, item)"
                    [disabled]="busy()"
                  >
                    Remove
                  </button>
                </div>
              </div>
            } @empty {
              <p class="muted">
                Add your {{ section }} to complete your story.
              </p>
            }
          </section>
        }
      </div>
    }
    @if (editing()) {
      <div class="modal-backdrop">
        <section
          class="card modal"
          role="dialog"
          aria-modal="true"
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          (keydown.escape)="!busy() && editing.set('')"
          aria-labelledby="editor-title"
        >
          <h2 id="editor-title">
            {{ editId ? "Edit" : "Add" }} {{ editing() }}
          </h2>
          @if (editError()) {
            <p class="error" role="alert">{{ editError() }}</p>
          }
          <form [formGroup]="entry" (ngSubmit)="saveEntry()">
            @for (f of entryFields(); track f.key) {
              <mat-form-field appearance="outline"
                ><mat-label>{{ f.label }}</mat-label
                ><input
                  matInput
                  [formControlName]="f.key"
                  [type]="f.type || 'text'"
                /><mat-error>Check this field.</mat-error></mat-form-field
              >
            }
            <div class="actions">
              <button mat-flat-button [disabled]="busy()">Save</button
              ><button
                mat-button
                type="button"
                (click)="editing.set('')"
                [disabled]="busy()"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      </div>
    }`,
})
export class ProfilePage {
  private api = inject(Api);
  private auth = inject(Auth);
  profile = signal<Profile | null>(null);
  busy = signal(false);
  error = signal("");
  message = signal("");
  editing = signal("");
  editError = signal("");
  editId: number | null = null;
  entry = new FormGroup<Record<string, FormControl>>({});
  entryFields = signal<Field[]>([]);
  sectionNames = Object.keys(sections);
  personalFields: Field[] = [
    { key: "firstName", label: "First name", required: true, max: 100 },
    { key: "lastName", label: "Last name", required: true, max: 100 },
    { key: "headline", label: "Professional headline", max: 200 },
    { key: "location", label: "Location", max: 255 },
    { key: "phone", label: "Phone", max: 30 },
    { key: "linkedinUrl", label: "LinkedIn URL", type: "url", max: 500 },
    { key: "githubUrl", label: "GitHub URL", type: "url", max: 500 },
    { key: "portfolioUrl", label: "Portfolio URL", type: "url", max: 500 },
    { key: "summary", label: "About you", max: 3000 },
  ];
  form = this.makeForm(this.personalFields);
  constructor() {
    void this.load();
  }
  makeForm(fields: Field[], values: Record<string, unknown> = {}) {
    return new FormGroup(
      Object.fromEntries(
        fields.map((f) => [
          f.key,
          new FormControl(values[f.key] ?? "", [
            ...(f.required ? [Validators.required] : []),
            Validators.maxLength(f.max ?? 255),
            ...(f.type === "url" ? [Validators.pattern(/^https?:\/\/.+/)] : []),
          ]),
        ]),
      ),
    );
  }
  async load() {
    this.busy.set(true);
    try {
      const p = await this.api.get<Profile>("/job-seekers/me");
      this.profile.set(p);
      for (const f of this.personalFields)
        this.form.controls[f.key].setValue(p[f.key as keyof Profile] ?? "");
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  items(key: string) {
    return (this.profile()?.[key as keyof Profile] || []) as Record<
      string,
      unknown
    >[];
  }
  path(section: string) {
    return section === "certifications"
      ? "/job-seekers/me/certifications"
      : "/job-seekers/" + this.auth.user()!.profileId + "/" + section;
  }
  async save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.error.set("");
    try {
      await this.api.put("/job-seekers/me", this.form.getRawValue());
      this.auth.refreshIdentity();
      this.message.set("Profile saved.");
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  edit(section: string, item: Record<string, unknown> = {}) {
    this.entryFields.set(sections[section]);
    this.entry = this.makeForm(sections[section], item);
    this.editId = (item["id"] as number) || null;
    this.editError.set("");
    this.editing.set(section);
  }
  async saveEntry() {
    if (this.entry.invalid) {
      this.entry.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.editError.set("");
    try {
      const body = Object.fromEntries(
        Object.entries(this.entry.getRawValue()).map(([k, v]) => [
          k,
          v === "" ? null : v,
        ]),
      );
      if (this.editId)
        await this.api.put(this.path(this.editing()) + "/" + this.editId, body);
      else await this.api.post(this.path(this.editing()), body);
      this.editing.set("");
      await this.load();
    } catch (e) {
      this.editError.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async remove(section: string, item: Record<string, unknown>) {
    if (!confirm("Remove this " + section + " entry?")) return;
    this.busy.set(true);
    this.error.set("");
    try {
      await this.api.delete(this.path(section) + "/" + item["id"]);
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
