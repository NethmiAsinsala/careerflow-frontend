import { Component } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import {
  provideRouter,
  RouterOutlet,
  Routes,
  withInMemoryScrolling,
} from "@angular/router";
import { authGuard, authInterceptor } from "./app/core";
import { Shell } from "./app/shell";
const candidate = { roles: ["JOB_SEEKER"] },
  employer = { roles: ["EMPLOYER"] },
  admin = { roles: ["ADMIN"] };
const routes: Routes = [
  {
    path: "login",
    loadComponent: () => import("./app/auth.page").then((m) => m.AuthPage),
  },
  {
    path: "register",
    data: { register: true },
    loadComponent: () => import("./app/auth.page").then((m) => m.AuthPage),
  },
  {
    path: "",
    component: Shell,
    children: [
      { path: "", pathMatch: "full", redirectTo: "dashboard" },
      {
        path: "dashboard",
        canActivate: [authGuard],
        loadComponent: () =>
          import("./app/dashboard.page").then((m) => m.DashboardPage),
      },
      {
        path: "jobs",
        loadComponent: () => import("./app/jobs.page").then((m) => m.JobsPage),
      },
      {
        path: "jobs/:id",
        loadComponent: () =>
          import("./app/jobs.page").then((m) => m.JobDetailPage),
      },
      {
        path: "profile",
        canActivate: [authGuard],
        data: candidate,
        loadComponent: () =>
          import("./app/profile.page").then((m) => m.ProfilePage),
      },
      {
        path: "resume",
        canActivate: [authGuard],
        data: candidate,
        loadComponent: () =>
          import("./app/resume.page").then((m) => m.ResumePage),
      },
      {
        path: "applications",
        canActivate: [authGuard],
        data: candidate,
        loadComponent: () =>
          import("./app/activity.page").then((m) => m.ActivityPage),
      },
      {
        path: "saved",
        canActivate: [authGuard],
        data: { ...candidate, saved: true },
        loadComponent: () =>
          import("./app/activity.page").then((m) => m.ActivityPage),
      },
      {
        path: "manage-jobs",
        canActivate: [authGuard],
        data: employer,
        loadComponent: () =>
          import("./app/employer.page").then((m) => m.EmployerPage),
      },
      {
        path: "manage-jobs/:jobId/applicants",
        canActivate: [authGuard],
        data: employer,
        loadComponent: () =>
          import("./app/activity.page").then((m) => m.ActivityPage),
      },
      {
        path: "company",
        canActivate: [authGuard],
        data: employer,
        loadComponent: () =>
          import("./app/employer.page").then((m) => m.CompanyPage),
      },
      {
        path: "users",
        canActivate: [authGuard],
        data: admin,
        loadComponent: () =>
          import("./app/admin.page").then((m) => m.UsersPage),
      },
      {
        path: "moderation",
        canActivate: [authGuard],
        data: { ...admin, admin: true },
        loadComponent: () =>
          import("./app/admin.page").then((m) => m.ReportsPage),
      },
      {
        path: "reports",
        canActivate: [authGuard],
        loadComponent: () =>
          import("./app/admin.page").then((m) => m.ReportsPage),
      },
      { path: "**", redirectTo: "dashboard" },
    ],
  },
];
@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet],
  template: "<router-outlet/>",
})
class App {}
bootstrapApplication(App, {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: "enabled" }),
    ),
  ],
}).catch(console.error);
