import { TestBed } from "@angular/core/testing";
import {
  provideHttpClient,
  withInterceptors,
  HttpClient,
  HttpErrorResponse,
} from "@angular/common/http";
import {
  provideHttpClientTesting,
  HttpTestingController,
} from "@angular/common/http/testing";
import {
  provideRouter,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from "@angular/router";
import {
  Api,
  Auth,
  authInterceptor,
  authGuard,
  safeReturnUrl,
  errorMessage,
} from "./core";
import { nextStatuses } from "./activity.page";
describe("Session and API boundaries", () => {
  let http: HttpTestingController;
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });
  it("stores a session only after a successful login", async () => {
    const auth = TestBed.inject(Auth);
    const result = auth.login("test@example.com", "password");
    const req = http.expectOne("/api/auth/login");
    expect(req.request.body).toEqual({
      email: "test@example.com",
      password: "password",
    });
    expect(auth.token()).toBe("");
    req.flush({
      accessToken: "test-token",
      user: {
        userId: 1,
        email: "test@example.com",
        role: "JOB_SEEKER",
        profileId: 3,
      },
    });
    await result;
    expect(auth.user()?.profileId).toBe(3);
    expect(sessionStorage.getItem("careerflow-token")).toBe("test-token");
  });
  it("sends bearer credentials only to relative backend API routes", () => {
    TestBed.inject(Auth).token.set("private-token");
    const client = TestBed.inject(HttpClient);
    client.get("/api/jobs").subscribe();
    client.get("https://external.example/api/jobs").subscribe();
    const own = http.expectOne("/api/jobs"),
      external = http.expectOne("https://external.example/api/jobs");
    expect(own.request.headers.get("Authorization")).toBe(
      "Bearer private-token",
    );
    expect(external.request.headers.has("Authorization")).toBe(false);
    own.flush([]);
    external.flush([]);
  });
  it("restores identity from the server instead of trusting a stored role", async () => {
    const auth = TestBed.inject(Auth);
    auth.token.set("valid");
    const restored = auth.restore();
    expect(auth.user()).toBeNull();
    http
      .expectOne("/api/auth/me")
      .flush({
        userId: 2,
        email: "employer@example.com",
        role: "EMPLOYER",
        profileId: 7,
      });
    expect(await restored).toBe(true);
    expect(auth.user()?.role).toBe("EMPLOYER");
  });
  it("clears local credentials when logout cannot reach the server", async () => {
    const auth = TestBed.inject(Auth);
    auth.token.set("old");
    sessionStorage.setItem("careerflow-token", "old");
    const logout = auth.logout();
    const assertion = expect(logout).rejects.toBeTruthy();
    http.expectOne("/api/auth/logout").error(new ProgressEvent("error"));
    await assertion;
    expect(auth.token()).toBe("");
    expect(sessionStorage.getItem("careerflow-token")).toBeNull();
  });
  it("blocks a candidate from the employer route", async () => {
    const auth = TestBed.inject(Auth);
    auth.user.set({
      userId: 1,
      email: "candidate@example.com",
      role: "JOB_SEEKER",
      profileId: 5,
    });
    const result = await TestBed.runInInjectionContext(() =>
      authGuard(
        { data: { roles: ["EMPLOYER"] } } as unknown as ActivatedRouteSnapshot,
        { url: "/manage-jobs" } as RouterStateSnapshot,
      ),
    );
    expect(TestBed.inject(Router).serializeUrl(result as never)).toBe(
      "/dashboard",
    );
  });
  it("keeps the requested route when requiring sign-in", async () => {
    const result = await TestBed.runInInjectionContext(() =>
      authGuard(
        { data: {} } as ActivatedRouteSnapshot,
        { url: "/resume" } as RouterStateSnapshot,
      ),
    );
    expect(TestBed.inject(Router).serializeUrl(result as never)).toBe(
      "/login?returnUrl=%2Fresume",
    );
  });
  it("uploads multipart data without setting a JSON content type", async () => {
    const form = new FormData();
    form.append("file", new File(["%PDF-test"], "resume.pdf"));
    const result = TestBed.inject(Api).post("/job-seekers/me/resume", form);
    const req = http.expectOne("/api/job-seekers/me/resume");
    expect(req.request.body).toBe(form);
    expect(req.request.headers.has("Content-Type")).toBe(false);
    req.flush({ filename: "resume.pdf" });
    await result;
  });
});
describe("Navigation and workflow safety", () => {
  it("rejects external and protocol-relative return URLs", () => {
    for (const url of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/login",
    ])
      expect(safeReturnUrl(url)).toBe("/dashboard");
    expect(safeReturnUrl("/jobs/12")).toBe("/jobs/12");
  });
  it("allows only the next hiring stage or rejection", () => {
    expect(nextStatuses("APPLIED")).toEqual(["SHORTLISTED", "REJECTED"]);
    expect(nextStatuses("OFFERED")).toEqual(["HIRED", "REJECTED"]);
    expect(nextStatuses("HIRED")).toEqual([]);
    expect(nextStatuses("REJECTED")).toEqual([]);
  });
  it("explains offline and validation errors", () => {
    expect(errorMessage(new HttpErrorResponse({ status: 0 }))).toContain(
      "port 8080",
    );
    expect(
      errorMessage(
        new HttpErrorResponse({
          status: 422,
          error: { detail: "Upload a text-based PDF." },
        }),
      ),
    ).toBe("Upload a text-based PDF.");
  });
});
