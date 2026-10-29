"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { forgotPasswordAction, type ForgotPasswordResult } from "../actions";

export function ForgotPasswordForm() {
  const wrappedAction = async (state: ForgotPasswordResult, formData: FormData): Promise<ForgotPasswordResult> => {
    const result = await forgotPasswordAction(state, formData);
    if (result === undefined) return state;
    return result;
  };
  const [state, formAction, pending] = useActionState<ForgotPasswordResult, FormData>(wrappedAction, null);
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

      {state?.error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <Button type="submit" variant="accent" loading={pending} className="w-full">
        Send reset code
      </Button>
    </form>
  );
}
