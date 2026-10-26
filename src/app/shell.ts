import { Component, inject, signal, computed, effect } from "@angular/core";
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from "@angular/router";
import { Api, Auth, Company, Profile } from "./core";
import { Icon, ThemeToggle } from "./appearance";
import { MatButtonModule } from "@angular/material/button";
@Component({
  standalone: true,
  host: { class: "workspace-shell" },
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatButtonModule,
    Icon,
    ThemeToggle,
  ],
  template: ` <a class="skip" href="#main">Skip to content</a>
    <div class="workspace">
      <aside class="sidebar">
        <a class="brand" routerLink="/dashboard"><b>cf.</b> careerflow</a>
        <p class="nav-label">YOUR WORKSPACE</p>
        <nav aria-label="Main navigation">
          @for (item of navigation(); track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="active"
              ariaCurrentWhenActive="page"
            >
              <cf-icon [name]="item.icon" /><span>{{ item.label }}</span>
            </a>
          }
        </nav>
        <div class="sidebar-bottom">
          <p class="muted">One step closer<br />to what’s next.</p>
          <small>CAREERFLOW © {{ year }}</small>
        </div>
      </aside>
      <div class="workspace-main">
        <header class="topbar">
          <span>{{ roleLabel() }}</span>
          <div class="topbar-actions">
            <cf-theme-toggle />
            @if (auth.user()) {
              <a
                class="account"
                [routerLink]="accountPath()"
                [attr.aria-label]="displayName() + ' — ' + userType()"
              >
                <span class="avatar"
                  ><cf-icon
                    [name]="
                      auth.user()?.role === 'EMPLOYER'
                        ? 'company'
                        : auth.user()?.role === 'ADMIN'
                          ? 'shield'
                          : 'person'
                    "
                /></span>
                <span class="account-copy"
                  ><strong>{{ displayName() }}</strong
                  ><small>{{ userType() }}</small></span
                > </a
              ><button mat-button (click)="logout()" [disabled]="busy()">
                Sign out
              </button>
            } @else {
              <a mat-button routerLink="/login">Sign in</a
              ><a mat-flat-button routerLink="/register">Get started</a>
            }
          </div>
        </header>
        <main id="main" tabindex="-1"><router-outlet /></main>
      </div>
    </div>`,
})
export class Shell {
  auth = inject(Auth);
  private router = inject(Router);
  busy = signal(false);
  year = new Date().getFullYear();
  private api = inject(Api);
  private name = signal("");
  userType = computed(() =>
    this.auth.user()?.role === "EMPLOYER"
      ? "Employer"
      : this.auth.user()?.role === "ADMIN"
        ? "Administrator"
        : "Candidate",
  );
  displayName = computed(() => this.name() || this.userType());
  accountPath = computed(() =>
    this.auth.user()?.role === "EMPLOYER"
      ? "/company"
      : this.auth.user()?.role === "ADMIN"
        ? "/users"
        : "/profile",
  );
  navigation = computed(() => {
    const role = this.auth.user()?.role;
    const items = [
      { path: "/dashboard", label: "Overview", icon: "dashboard" },
      { path: "/jobs", label: "Explore jobs", icon: "search" },
    ];
    if (role === "JOB_SEEKER")
      items.push(
        { path: "/saved", label: "Saved jobs", icon: "bookmark" },
        {
          path: "/applications",
          label: "My applications",
          icon: "applications",
        },
        { path: "/resume", label: "Resume studio", icon: "resume" },
        { path: "/profile", label: "My profile", icon: "person" },
      );
    if (role === "EMPLOYER")
      items.push(
        { path: "/manage-jobs", label: "Manage jobs", icon: "briefcase" },
        { path: "/company", label: "Company profile", icon: "company" },
      );
    if (role === "ADMIN")
      items.push(
        { path: "/users", label: "Manage users", icon: "users" },
        { path: "/moderation", label: "Moderation", icon: "shield" },
      );
    if (role)
      items.push({ path: "/reports", label: "My reports", icon: "flag" });
    return items;
  });
  constructor() {
    void this.auth.restore();
    effect((onCleanup) => {
      const user = this.auth.user();
      this.auth.identityRevision();
      this.name.set("");
      let active = true;
      onCleanup(() => {
        active = false;
      });
      if (!user || user.role === "ADMIN") return;
      const request =
        user.role === "EMPLOYER"
          ? this.api
              .get<Company>("/companies/employer/" + user.profileId)
              .then((c) => c.name)
          : this.api
              .get<Profile>("/job-seekers/me")
              .then((p) => [p.firstName, p.lastName].filter(Boolean).join(" "));
      void request
        .then((name) => {
          if (active) this.name.set(name?.trim() || "");
        })
        .catch(() => {
          /* Role label remains available if profile cannot load. */
        });
    });
  }
  roleLabel() {
    return this.auth.user()?.role === "EMPLOYER"
      ? "Employer workspace"
      : this.auth.user()?.role === "ADMIN"
        ? "Administration"
        : "Your career, in focus";
  }
  async logout() {
    this.busy.set(true);
    try {
      await this.auth.logout();
    } catch {
      /* Local session is cleared even if server cannot be reached. */
    } finally {
      this.busy.set(false);
      await this.router.navigateByUrl("/login");
    }
  }
}
