"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/Button";
import { resendVerification } from "./actions";

export function ResendButton() {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        loading={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const fd = new FormData();
            const res = await resendVerification(fd);
            if (res.ok) setSent(true);
            else setError(res.error);
          });
        }}
      >
        Resend verification email
      </Button>
      {sent && <p className="mt-2 text-xs text-green-700">Sent. Check your spam folder if it's not there.</p>}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </>
  );
}
