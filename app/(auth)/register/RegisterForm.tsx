"use client";

import { useActionState } from "react";
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
        <Input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          invalid={!!fe.password}
        />
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
