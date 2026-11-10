"use client";

import { useActionState, useState } from "react";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { loginAction, type AuthFormState } from "../actions";

export function LoginForm() {
  const wrappedLoginAction = async (state: AuthFormState, formData: FormData): Promise<AuthFormState> => {
    const result = await loginAction(state, formData);
    if (result === undefined) return state;
    return result;
  };
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(wrappedLoginAction, null);
  const [showPassword, setShowPassword] = useState(false);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4">
      <Field label="Email" name="email" error={fe.email}>
        <Input
          type="email"
          name="email"
          autoComplete="email"
          required
          invalid={!!fe.email}
        />
      </Field>
      <Field label="Password" name="password" error={fe.password}>
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="current-password"
            required
            invalid={!!fe.password}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink focus:outline-none"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
          >
            {showPassword
              ? <Icon.EyeOff aria-hidden="true" className="h-4 w-4" />
              : <Icon.Eye aria-hidden="true" className="h-4 w-4" />}
          </button>
        </div>
      </Field>

      {state?.error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <Button type="submit" variant="accent" loading={pending} className="w-full">
        Sign in
      </Button>
    </form>
  );
}
