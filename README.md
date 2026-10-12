# CareerFlow frontend

Angular 21 standalone application with Angular Material, reactive forms, a Clarity-inspired workspace layout, and the approved warm Editorial palette. Screens use the existing CareerFlow REST API; there is no sample-data fallback.

## Run locally

Prerequisites: Node.js 22.12+ or compatible Node 24, npm, and the CareerFlow backend running on port 8080.

```powershell
npm ci
npm start
```

Open http://localhost:4200. The Angular development proxy forwards `/api/**` to `http://localhost:8080`. Start your existing backend from IntelliJ as usual. Ollama is required only for resume analysis; the configured backend model must be installed.

```powershell
npm run build
npm test
```

## Verification in this development session

Angular template/type compilation, test-source type checking, SCSS compilation, and eight direct session/API checks passed. The production build and standard Angular test runner could not complete because this restricted Windows session rejects bundler child processes with `spawn EPERM`. Browser rendering and end-to-end calls against your backend remain unverified; the backend was offline during these checks. Run the build and tests in your normal terminal before relying on the application.

The direct checks can also run without the bundler:

```powershell
node node_modules/@angular/compiler-cli/bundles/src/bin/ngc.js -p tsconfig.app.json
node scripts/verify-session.mjs
```

If your Windows network uses a trusted corporate root certificate and npm reports a certificate-chain error, run `$env:NODE_OPTIONS='--use-system-ca'` before npm. Certificate verification remains enabled.

## Included screens

- Registration and login, session restoration, logout, role-protected routes.
- Candidate overview, job filters and pagination, job details, skill match, applications, saved jobs.
- Personal details, skills, education, experience, projects and certifications.
- PDF resume upload/download/delete and local Ollama feedback.
- Employer overview, company profile, job creation/editing/deletion, applicant profiles and hiring stages.
- Admin overview, paginated users, account suspension/reactivation and report resolution.
- Authenticated content reports and report history.

## Test against your backend

1. Start the backend, then run `npm start`. Open `/jobs` while signed out. Confirm search, empty results, pagination and job details.
2. Register a JOB_SEEKER account, sign in, update the profile and add skills. Refresh the page to verify session restoration.
3. Upload a PDF below 5 MB. Download it, then analyze it with Ollama running. Check the helpful error when Ollama is offline. Suggestions should not silently change profile skills.
4. Register a separate EMPLOYER account. Save a company profile and create an OPEN job with a future deadline. Confirm it appears in public search.
5. As the candidate, save the job and apply. Check Saved jobs and My applications. Duplicate actions should show the backend error.
6. As the employer, open that job's applicants, inspect the candidate and download the resume. Move the application through Shortlisted → Interview → Offered → Hired. Check the candidate's updated status.
7. Use an existing backend admin account to view users and review reports. Public registration cannot create an admin. Confirm admin accounts cannot be suspended.
8. Test a narrow mobile viewport, keyboard navigation, logout, expired credentials and an unavailable backend. Accessing a different role's page must redirect to the dashboard; the backend independently enforces authorization.

## Security and deployment

The bearer token lives in sessionStorage for same-tab reloads. No password is stored. The interceptor sends credentials only to relative `/api/` requests; backend authorization remains authoritative. Tokens expire according to the backend; there is no refresh-token endpoint. If server logout fails, local credentials are still cleared, but server revocation cannot be guaranteed.

Production files are generated in `dist/careerflow/browser`. Serve them with HTTPS, SPA fallback to `index.html`, and a same-origin `/api/` reverse proxy to the backend. The development proxy is not included in the production build. Set security headers at the hosting layer and do not put backend secrets into the frontend.

Salary currency is not present in the API contract, so the UI does not invent one. Job deadlines use the backend's local datetime contract; configure server time consistently with the intended employer timezone. Resume analysis operates on the saved resume only.
