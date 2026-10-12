import { Component, inject, signal } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { Api, Auth, errorMessage, safeReturnUrl } from "./core";
import { ThemeToggle } from "./appearance";
import { UI } from "./ui";
@Component({
  standalone: true,
  imports: [...UI, ThemeToggle],
  template: ` <div class="auth-layout">
    <section class="auth-story">
      <a class="brand" routerLink="/jobs"><b>cf.</b> careerflow</a>
      <div>
        <span class="eyebrow">A LITTLE DIRECTION. A NEW CHAPTER.</span>
        <h1>Good work.<br />Great possibilities.</h1>
        <p>
          A thoughtful space to find your next role, tell your story, and move
          forward.
        </p>
      </div>
      <small>Built around your next step.</small>
    </section>
    <main class="auth-form">
      <div class="auth-theme"><cf-theme-toggle /></div>
      <span class="eyebrow">LET’S GET STARTED</span>
      <h2>{{ register ? "Create your account" : "Welcome back." }}</h2>
      <p class="muted">
        {{
          register
            ? "Your next chapter starts here."
            : "Sign in to pick up where you left off."
        }}
      </p>
      @if (message()) {
        <p class="notice" role="status">{{ message() }}</p>
      }
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      <form [formGroup]="form" (ngSubmit)="submit()">
        <mat-form-field appearance="outline"
          ><mat-label>Email address</mat-label
          ><input
            matInput
            type="email"
            formControlName="email"
            autocomplete="email"
          /><mat-error>Enter a valid email address.</mat-error></mat-form-field
        >
        <mat-form-field appearance="outline"
          ><mat-label>Password</mat-label
          ><input
            matInput
            type="password"
            formControlName="password"
            [attr.autocomplete]="register ? 'new-password' : 'current-password'"
          /><mat-error>{{
            register ? "Use 8–72 characters." : "Enter your password."
          }}</mat-error></mat-form-field
        >
        @if (register) {
          <mat-form-field appearance="outline"
            ><mat-label>I’m here to</mat-label
            ><mat-select formControlName="role"
              ><mat-option value="JOB_SEEKER">Find my next role</mat-option
              ><mat-option value="EMPLOYER"
                >Hire great people</mat-option
              ></mat-select
            ></mat-form-field
          >
        }
        <button mat-flat-button [disabled]="busy()" type="submit">
          {{
            busy() ? "Please wait…" : register ? "Create account" : "Sign in"
          }}
          <span aria-hidden="true">↗</span>
        </button>
      </form>
      <p>
        {{ register ? "Already have an account?" : "New to CareerFlow?" }}
        <a [routerLink]="register ? '/login' : '/register'">{{
          register ? "Sign in" : "Create an account"
        }}</a>
      </p>
      <a routerLink="/jobs">Explore available jobs →</a>
    </main>
  </div>`,
})
export class AuthPage {
  private api = inject(Api);
  private auth = inject(Auth);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  register = this.route.snapshot.data["register"] === true;
  busy = signal(false);
  error = signal("");
  message = signal("");
  form = inject(FormBuilder).nonNullable.group({
    email: [
      "",
      [Validators.required, Validators.email, Validators.maxLength(255)],
    ],
    password: [
      "",
      [
        Validators.required,
        Validators.minLength(this.register ? 8 : 1),
        Validators.maxLength(72),
      ],
    ],
    role: ["JOB_SEEKER"],
  });
  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.error.set("");
    try {
      const v = this.form.getRawValue();
      if (this.register) {
        await this.api.post("/auth/register", v);
        this.register = false;
        this.message.set("Account created. Sign in to continue.");
        this.form.controls.password.reset();
      } else {
        await this.auth.login(v.email, v.password);
        await this.router.navigateByUrl(
          safeReturnUrl(this.route.snapshot.queryParamMap.get("returnUrl")),
        );
      }
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
