import { Injectable, inject, signal } from "@angular/core";
import {
  HttpClient,
  HttpErrorResponse,
  HttpInterceptorFn,
} from "@angular/common/http";
import { CanActivateFn, Router } from "@angular/router";
import { firstValueFrom, catchError, throwError } from "rxjs";

export type Role = "JOB_SEEKER" | "EMPLOYER" | "ADMIN";
export interface User {
  userId: number;
  email: string;
  role: Role;
  profileId: number;
}
export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}
export interface Job {
  id: number;
  employerId: number;
  title: string;
  description: string;
  location: string;
  employmentType: string;
  experienceLevel: string;
  salaryMin: number | null;
  salaryMax: number | null;
  skills: string;
  applicationDeadline: string | null;
  status: string;
}
export interface Application {
  id: number;
  jobId: number;
  jobSeekerId: number;
  status: string;
  coverLetter: string;
  appliedAt: string;
}
export interface SavedJob {
  id: number;
  jobId: number;
  jobTitle: string;
  companyName: string;
  location: string;
}
export interface Recommendation {
  job: Job;
  matchPercentage: number;
  matchedSkills: string[];
  missingSkills: string[];
}
export interface Analysis {
  model: string;
  note: string;
  feedback: {
    summary: string;
    skills: string[];
    strengths: string[];
    improvements: string[];
  };
}
export interface Report {
  id: number;
  targetType: string;
  targetId: number;
  reason: string;
  status: string;
  resolution: string;
}
export interface AdminUser {
  id: number;
  email: string;
  role: Role;
  active: boolean;
}
export interface Company {
  id: number;
  name: string;
  description: string;
  industry: string;
  website: string;
  location: string;
  logoUrl: string;
}
export interface Profile {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  headline: string;
  summary: string;
  location: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  skills: { id: number; name: string }[];
  education: Record<string, unknown>[];
  experience: Record<string, unknown>[];
  projects: Record<string, unknown>[];
  certifications: Record<string, unknown>[];
}
export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0)
      return "Cannot reach the backend. Check that it is running on port 8080.";
    return (
      error.error?.detail ||
      error.error?.message ||
      (error.status === 403
        ? "You do not have access to this action."
        : `Request failed (${error.status}). Please try again.`)
    );
  }
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
@Injectable({ providedIn: "root" })
export class Api {
  private http = inject(HttpClient);
  get<T>(path: string, params: Record<string, string | number | boolean> = {}) {
    return firstValueFrom(this.http.get<T>("/api" + path, { params }));
  }
  post<T>(path: string, body: unknown = {}) {
    return firstValueFrom(this.http.post<T>("/api" + path, body));
  }
  put<T>(path: string, body: unknown) {
    return firstValueFrom(this.http.put<T>("/api" + path, body));
  }
  patch<T>(path: string, body: unknown, params: Record<string, string> = {}) {
    return firstValueFrom(this.http.patch<T>("/api" + path, body, { params }));
  }
  delete(path: string) {
    return firstValueFrom(this.http.delete<void>("/api" + path));
  }
  async download(path: string) {
    const blob = await firstValueFrom(
      this.http.get("/api" + path, { responseType: "blob" }),
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resume.pdf";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
@Injectable({ providedIn: "root" })
export class Auth {
  private api = inject(Api);
  user = signal<User | null>(null);
  identityRevision = signal(0);
  refreshIdentity() {
    this.identityRevision.update((value) => value + 1);
  }
  token = signal(sessionStorage.getItem("careerflow-token") || "");
  private restoring: Promise<boolean> | null = null;
  async login(email: string, password: string) {
    const r = await this.api.post<{ accessToken: string; user: User }>(
      "/auth/login",
      { email, password },
    );
    this.token.set(r.accessToken);
    sessionStorage.setItem("careerflow-token", r.accessToken);
    this.user.set(r.user);
  }
  restore(): Promise<boolean> {
    if (this.user()) return Promise.resolve(true);
    if (!this.token()) return Promise.resolve(false);
    return (this.restoring ??= this.api
      .get<User>("/auth/me")
      .then((u) => {
        this.user.set(u);
        return true;
      })
      .catch(() => {
        this.clear();
        return false;
      })
      .finally(() => (this.restoring = null)));
  }
  clear() {
    this.user.set(null);
    this.token.set("");
    sessionStorage.removeItem("careerflow-token");
  }
  async logout() {
    try {
      await this.api.post("/auth/logout");
    } finally {
      this.clear();
    }
  }
}
export function safeReturnUrl(value: string | null): string {
  return value?.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !value.startsWith("/login") &&
    !value.startsWith("/register")
    ? value
    : "/dashboard";
}
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth),
    router = inject(Router);
  const scoped = req.url.startsWith("/api/");
  const token = auth.token();
  return next(
    scoped && token
      ? req.clone({ setHeaders: { Authorization: "Bearer " + token } })
      : req,
  ).pipe(
    catchError((e) => {
      if (
        scoped &&
        token &&
        e.status === 401 &&
        !req.url.endsWith("/auth/login")
      ) {
        auth.clear();
        void router.navigate(["/login"], {
          queryParams: { returnUrl: router.url },
        });
      }
      return throwError(() => e);
    }),
  );
};
export const authGuard: CanActivateFn = async (route, state) => {
  const a = inject(Auth),
    r = inject(Router);
  if (!(await a.restore()))
    return r.createUrlTree(["/login"], {
      queryParams: { returnUrl: state.url },
    });
  const roles = route.data["roles"] as Role[] | undefined;
  return !roles || roles.includes(a.user()!.role)
    ? true
    : r.createUrlTree(["/dashboard"]);
};

export interface JobAnalysis {
  analysis: Analysis;
  comparison: {
    jobId: number;
    jobTitle: string;
    percentage: number | null;
    matchedSkills: string[];
    missingSkills: string[];
    requiredCount: number;
    explanation: string;
  };
}
