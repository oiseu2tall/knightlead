"use client";

import { useActionState } from "react";
import { verifyOtpAction, type AuthFormState } from "../(auth)/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

export function VerifyOtpForm({ email }: { email: string }) {
  const wrappedAction = async (state: AuthFormState, formData: FormData): Promise<AuthFormState> => {
    const result = await verifyOtpAction(state, formData);
    if (result === undefined) return state;
    return result;
  };
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(wrappedAction, null);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div className="text-center">
        <p className="mb-2 text-sm text-ink-muted">
          We sent a verification code to <strong className="break-all text-ink">{email}</strong>.
        </p>
        <p className="text-xs text-ink-muted">
          Enter the 8-character code below. It expires in 15 minutes.
        </p>
      </div>

      <div className="flex justify-center">
        <Input
          name="code"
          placeholder="ABCDEFGH"
          maxLength={8}
          minLength={8}
          autoComplete="one-time-code"
          required
          className="w-48 text-center font-mono text-xl"
        />
      </div>

      {state?.error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <Button type="submit" variant="accent" loading={pending} className="w-full">
        {pending ? "Verifying…" : "Verify email"}
      </Button>
    </form>
  );
}
