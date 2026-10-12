import { Component, Injectable, inject, input, signal } from "@angular/core";
import { DOCUMENT } from "@angular/common";

const paths: Record<string, string> = {
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  applications: "M9 5H5v16h14V5h-4 M9 3h6v4H9z M8 12h8 M8 16h5",
  bookmark: "M6 3h12v18l-6-4-6 4z",
  person: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 8 0 0 1 16 0v2",
  resume: "M14 2H5v20h14V7z M14 2v5h5 M8 12h8 M8 16h5",
  briefcase: "M3 7h18v14H3z M8 7V3h8v4 M3 12l9 3 9-3 M12 12v5",
  company: "M4 21V3h12v18 M16 9h4v12 M8 7h4 M8 11h4 M8 15h4 M9 21v-3h2v3",
  users:
    "M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M5 21v-3a7 7 0 0 1 14 0v3 M18 3a3 3 0 0 1 0 6 M21 18v-3a4 4 0 0 0-2-3",
  shield: "M12 2l9 4v6c0 5-9 10-9 10S3 17 3 12V6z M8 12l3 3 5-6",
  flag: "M5 22V3 M5 3c5-4 9 4 14 0v11c-5 4-9-4-14 0",
  moon: "M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10",
  sun: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M12 1v2 M12 21v2 M1 12h2 M21 12h2 M4 4l2 2 M18 18l2 2 M4 20l2-2 M18 6l2-2",
};
@Component({
  selector: "cf-icon",
  standalone: true,
  host: { "aria-hidden": "true" },
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    focusable="false"
  >
    <path [attr.d]="paths[name()] || paths['person']" />
  </svg>`,
})
export class Icon {
  name = input("person");
  paths = paths;
}

@Injectable({ providedIn: "root" })
export class Appearance {
  private document = inject(DOCUMENT);
  dark = signal(false);
  constructor() {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("careerflow-theme");
    } catch {
      /* Storage may be disabled. */
    }
    this.set(
      saved === "dark" ||
        (saved !== "light" &&
          !!this.document.defaultView?.matchMedia?.(
            "(prefers-color-scheme: dark)",
          ).matches),
      false,
    );
  }
  set(dark: boolean, persist = true) {
    this.dark.set(dark);
    this.document.documentElement.classList.toggle("dark-theme", dark);
    this.document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#191815" : "#f8f5ee");
    if (persist)
      try {
        localStorage.setItem("careerflow-theme", dark ? "dark" : "light");
      } catch {
        /* Keep the current theme without storage. */
      }
  }
}
@Component({
  selector: "cf-theme-toggle",
  standalone: true,
  imports: [Icon],
  template: `<div class="theme-control" role="group" aria-label="Color theme">
    <button
      type="button"
      class="theme-option"
      [class.selected]="!appearance.dark()"
      [attr.aria-pressed]="!appearance.dark()"
      (click)="appearance.set(false)"
    >
      <cf-icon name="sun" /><span>Light</span>
    </button>
    <button
      type="button"
      class="theme-option"
      [class.selected]="appearance.dark()"
      [attr.aria-pressed]="appearance.dark()"
      (click)="appearance.set(true)"
    >
      <cf-icon name="moon" /><span>Dark</span>
    </button>
  </div>`,
})
export class ThemeToggle {
  appearance = inject(Appearance);
}
