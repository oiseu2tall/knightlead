"use client";

import { useActionState, useState } from "react";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { resetPasswordAction, type ResetPasswordResult } from "../actions";

export function ResetPasswordForm() {
  const wrappedAction = async (state: ResetPasswordResult, formData: FormData): Promise<ResetPasswordResult> => {
    const result = await resetPasswordAction(state, formData);
    if (result === undefined) return state;
    return result;
  };
  const [state, formAction, pending] = useActionState<ResetPasswordResult, FormData>(wrappedAction, null);
  const [showPassword, setShowPassword] = useState(false);
  return (
    <form action={formAction} className="space-y-4">
      <Field label="Email" name="email" error={state?.error ?? undefined}>
        <Input
          type="email"
          name="email"
          autoComplete="email"
          required
          invalid={!!state?.error}
        />
      </Field>
      <Field label="Reset code" name="code" error={state?.error ?? undefined}>
        <Input
          type="text"
          name="code"
          autoComplete="one-time-code"
          required
          maxLength={8}
          minLength={8}
          invalid={!!state?.error}
          placeholder="ABCDEFGH"
          className="w-48 text-center font-mono text-xl"
        />
      </Field>
      <Field label="New password" name="password" error={state?.error ?? undefined}>
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="new-password"
            required
            invalid={!!state?.error}
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
        Reset password
      </Button>
    </form>
  );
}
