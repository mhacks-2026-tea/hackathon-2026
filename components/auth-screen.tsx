"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { AuthCampusAtmosphere } from "@/components/auth-campus-atmosphere";
import { MovinBrandMark } from "@/components/movin-brand-mark";

type AuthMode = "login" | "signup";

export function AuthScreen({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const isSignup = mode === "signup";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push("/dashboard");
  }

  return (
    <main className={`auth-screen auth-${mode}`}>
      <AuthCampusAtmosphere />
      <header className="auth-header">
        <Link className="auth-brand" href="/" aria-label="Movin home">
          <MovinBrandMark className="auth-school-mark" />
          <span className="brand-name">movin</span>
        </Link>
        <p className="auth-switch">
          {isSignup ? "Already have an account?" : "New to Movin?"}
          <Link href={isSignup ? "/login" : "/"}>
            {isSignup ? "Log in" : "Create an account"}
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </p>
      </header>

      <div className="auth-content">
        <p className="sample-caption">Hackathon demo · continue as Alex. No real account is created and credentials are not verified.</p>
        <section className="auth-story" aria-labelledby="auth-story-title">
          <p className="auth-kicker">HOUSING DECISIONS, MADE CLEAR</p>
          <h1 id="auth-story-title">
            {isSignup ? (
              <>
                Know what
                <br />
                you can afford
                <br />
                <span>before you move.</span>
              </>
            ) : (
              <>
                Your next move,
                <br />
                <span>starts with clarity.</span>
              </>
            )}
          </h1>
          <p className="auth-description">
            Movin brings your real income, spending, and local housing costs
            together to help you make the move that fits.
          </p>
          <ul className="auth-proof" aria-label="What Movin helps you understand">
            <li><b>01</b> True housing cost</li>
            <li><b>02</b> Risky months</li>
            <li><b>03</b> Safer scenarios</li>
          </ul>
        </section>

        <section className="auth-form-section" aria-labelledby="auth-form-title">
          <p className="auth-form-kicker">{isSignup ? "GET STARTED" : "WELCOME BACK"}</p>
          <h2 id="auth-form-title">
            {isSignup ? "Get started with Movin." : "Welcome back."}
          </h2>
          <p className="auth-form-subtitle">
            {isSignup
              ? "Use any email and password to preview the sign-up flow."
              : "Use any email and password to preview the login flow."}
          </p>
          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span>Email address</span>
              <input
                autoComplete="email"
                name="email"
                placeholder="you@example.com"
                required
                type="email"
              />
            </label>
            <label className="auth-field">
              <span>{isSignup ? "Create a password" : "Password"}</span>
              <input
                autoComplete={isSignup ? "new-password" : "current-password"}
                minLength={isSignup ? 8 : undefined}
                name="password"
                placeholder={isSignup ? "At least 8 characters" : "Enter any password"}
                required
                type="password"
              />
            </label>
            <button className="auth-submit" type="submit">
              <span>Continue to demo</span>
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
