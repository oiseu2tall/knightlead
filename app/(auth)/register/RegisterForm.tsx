"use client";

import { useActionState, useState } from "react";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { registerAction, type AuthFormState } from "../actions";

export function RegisterForm() {
  const wrappedRegisterAction = async (state: AuthFormState, formData: FormData): Promise<AuthFormState> => {
    const result = await registerAction(state, formData);
    if (result === undefined) return state;
    return result;
  };
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(wrappedRegisterAction, null);
  const [showPassword, setShowPassword] = useState(false);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4">
      <Field label="Full name" name="name" error={fe.name}>
        <Input
          name="name"
          autoComplete="name"
          required
          maxLength={80}
          invalid={!!fe.name}
        />
      </Field>
      <Field label="Email" name="email" error={fe.email}>
        <Input
          type="email"
          name="email"
          autoComplete="email"
          required
          invalid={!!fe.email}
        />
      </Field>
      <Field
        label="Password"
        name="password"
        error={fe.password}
        hint="At least 8 characters with upper, lower, and a number."
      >
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            invalid={!!fe.password}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink focus:outline-none"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.94 14.66l1.02-1.02a3 3 0 014.24 0l1.02 1.02M12 18a6 6 0 01-6-6c0-2.41.8-4.64 2.12-6.22" />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </Field>

      {state?.error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <Button type="submit" variant="accent" loading={pending} className="w-full">
        Create account
      </Button>
    </form>
  );
}
