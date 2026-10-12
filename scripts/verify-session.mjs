// Direct verification for environments where spawning the bundler is restricted.
// First compile: node node_modules/@angular/compiler-cli/bundles/src/bin/ngc.js -p tsconfig.app.json
import "@angular/compiler";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { TestBed } from "@angular/core/testing";
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from "@angular/platform-browser/testing";
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
import { provideRouter, Router } from "@angular/router";
import {
  Auth,
  Api,
  authInterceptor,
  authGuard,
  safeReturnUrl,
  errorMessage,
} from "../out-tsc/app/app/core.js";
const dom = new JSDOM("<html><body></body></html>", {
  url: "http://localhost:4200",
});
for (const key of [
  "window",
  "document",
  "sessionStorage",
  "HTMLElement",
  "Node",
  "ProgressEvent",
])
  globalThis[key] = dom.window[key];
TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
let passed = 0;
async function check(name, fn) {
  TestBed.resetTestingModule();
  sessionStorage.clear();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
    ],
  });
  await fn(TestBed.inject(Auth), TestBed.inject(HttpTestingController));
  TestBed.inject(HttpTestingController).verify();
  console.log("PASS", name);
  passed++;
}
await check("Login persists only a successful session", async (auth, http) => {
  const result = auth.login("candidate@example.com", "password");
  assert.equal(auth.token(), "");
  http
    .expectOne("/api/auth/login")
    .flush({
      accessToken: "token",
      user: {
        userId: 1,
        profileId: 3,
        role: "JOB_SEEKER",
        email: "candidate@example.com",
      },
    });
  await result;
  assert.equal(auth.user().profileId, 3);
  assert.equal(sessionStorage.getItem("careerflow-token"), "token");
});
await check("Credentials never go to external URLs", async (auth, http) => {
  auth.token.set("private");
  const client = TestBed.inject(HttpClient);
  client.get("/api/jobs").subscribe();
  client.get("https://external.example/api/jobs").subscribe();
  const own = http.expectOne("/api/jobs"),
    external = http.expectOne("https://external.example/api/jobs");
  assert.equal(own.request.headers.get("Authorization"), "Bearer private");
  assert.equal(external.request.headers.has("Authorization"), false);
  own.flush([]);
  external.flush([]);
});
await check("Session restoration uses server identity", async (auth, http) => {
  auth.token.set("valid");
  const result = auth.restore();
  http
    .expectOne("/api/auth/me")
    .flush({
      userId: 2,
      profileId: 7,
      role: "EMPLOYER",
      email: "employer@example.com",
    });
  assert.equal(await result, true);
  assert.equal(auth.user().role, "EMPLOYER");
});
await check("Offline logout clears local credentials", async (auth, http) => {
  auth.token.set("old");
  sessionStorage.setItem("careerflow-token", "old");
  const result = auth.logout();
  const rejected = assert.rejects(result);
  http.expectOne("/api/auth/logout").error(new ProgressEvent("error"));
  await rejected;
  assert.equal(auth.token(), "");
  assert.equal(sessionStorage.getItem("careerflow-token"), null);
});
await check("Candidate cannot open employer routes", async (auth) => {
  auth.user.set({
    userId: 1,
    profileId: 3,
    role: "JOB_SEEKER",
    email: "test@example.com",
  });
  const result = await TestBed.runInInjectionContext(() =>
    authGuard({ data: { roles: ["EMPLOYER"] } }, { url: "/manage-jobs" }),
  );
  assert.equal(TestBed.inject(Router).serializeUrl(result), "/dashboard");
});
await check("Sign-in redirect preserves the requested page", async () => {
  const result = await TestBed.runInInjectionContext(() =>
    authGuard({ data: {} }, { url: "/resume" }),
  );
  assert.equal(
    TestBed.inject(Router).serializeUrl(result),
    "/login?returnUrl=%2Fresume",
  );
});
await check("PDF uploads preserve multipart boundaries", async (_, http) => {
  const form = new FormData();
  form.append("file", new Blob(["%PDF-test"]), "resume.pdf");
  const result = TestBed.inject(Api).post("/job-seekers/me/resume", form);
  const request = http.expectOne("/api/job-seekers/me/resume");
  assert.equal(request.request.body, form);
  assert.equal(request.request.headers.has("Content-Type"), false);
  request.flush({ filename: "resume.pdf" });
  await result;
});
await check("Return URLs and offline messages are safe", async () => {
  for (const url of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/login",
  ])
    assert.equal(safeReturnUrl(url), "/dashboard");
  assert.equal(safeReturnUrl("/jobs/12"), "/jobs/12");
  assert.match(errorMessage(new HttpErrorResponse({ status: 0 })), /port 8080/);
});
TestBed.resetTestingModule();
dom.window.close();
console.log(`${passed} session/API checks passed.`);
