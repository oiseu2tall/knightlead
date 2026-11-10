"use client";

import { useActionState, useState } from "react";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { resetPasswordAction, type ResetPasswordResult } from "../actions";

export function ResetPasswordForm() {
  const wrappedAction = async (state: ResetPasswordResult, formData: FormData): Promise<ResetPasswordResult> => {
    const result = await resetPasswordAction(state, formData);
    if (result === undefined) return state;
    return result;
  };
  const [state, formAction, pending] = useActionState<ResetPasswordResult, FormData>(wrappedAction, null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formValues, setFormValues] = useState({
    email: "",
    code: "",
    password: "",
    confirmPassword: "",
  });
  const fieldErrors = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4">
      <Field label="Email" name="email" error={fieldErrors.email}>
        <Input
          type="email"
          name="email"
          value={formValues.email}
          onChange={(event) => setFormValues((values) => ({ ...values, email: event.target.value }))}
          autoComplete="email"
          required
          invalid={!!fieldErrors.email}
        />
      </Field>
      <Field label="Reset code" name="code" error={fieldErrors.code}>
        <Input
          type="text"
          name="code"
          value={formValues.code}
          onChange={(event) => setFormValues((values) => ({ ...values, code: event.target.value }))}
          autoComplete="one-time-code"
          required
          maxLength={8}
          minLength={8}
          invalid={!!fieldErrors.code}
          placeholder="ABCDEFGH"
          className="w-48 text-center font-mono text-xl"
        />
      </Field>
      <Field
        label="New password"
        name="password"
        error={fieldErrors.password}
        hint="Password must be at least 8 characters which must include minimum of an uppercase, a lowercase, a number, and a special character."
      >
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            name="password"
            value={formValues.password}
            onChange={(event) => setFormValues((values) => ({ ...values, password: event.target.value }))}
            autoComplete="new-password"
            required
            minLength={8}
            invalid={!!fieldErrors.password}
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

      <Field label="Confirm new password" name="confirmPassword" error={fieldErrors.confirmPassword}>
        <div className="relative">
          <Input
            type={showConfirmPassword ? "text" : "password"}
            name="confirmPassword"
            value={formValues.confirmPassword}
            onChange={(event) => setFormValues((values) => ({ ...values, confirmPassword: event.target.value }))}
            autoComplete="new-password"
            required
            minLength={8}
            invalid={!!fieldErrors.confirmPassword}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink focus:outline-none"
            aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
            aria-pressed={showConfirmPassword}
          >
            {showConfirmPassword
              ? <Icon.EyeOff aria-hidden="true" className="h-4 w-4" />
              : <Icon.Eye aria-hidden="true" className="h-4 w-4" />}
          </button>
        </div>
      </Field>

      {state?.error && !state.fieldErrors && (
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
