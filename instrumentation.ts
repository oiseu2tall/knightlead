// Next.js instrumentation hook — runs once on server boot. Used here
// to schedule periodic cleanup of rate-limit events.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { pruneRateLimitEvents } = await import("@/lib/rate-limit");
    // Prune every hour. setInterval in the Node runtime is fine for
    // long-running processes (Fly, Render, Railway, EC2); for serverless
    // short-lived invocations, move this to a cron job.
    const ONE_HOUR = 60 * 60 * 1000;
    setInterval(() => {
      pruneRateLimitEvents().catch((e) => {
        // eslint-disable-next-line no-console
        console.error("[rate-limit] prune failed:", e);
      });
    }, ONE_HOUR);
  }
}
