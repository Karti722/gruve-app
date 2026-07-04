import Anthropic from "@anthropic-ai/sdk";

/**
 * Extracts a safe, user-facing message from a thrown error. For Anthropic
 * API errors this pulls out the specific reason (e.g. "Your credit balance
 * is too low...") instead of the SDK's generic wrapper message, so failures
 * are self-explanatory directly in the UI instead of requiring a trip
 * through server logs.
 */
export function describeError(err: unknown): string {
  if (err instanceof Anthropic.APIError) {
    const nested = (err.error as { error?: { message?: string } } | undefined)?.error?.message;
    return nested ?? err.message;
  }

  if (err instanceof Error) return err.message;

  return "An unknown error occurred.";
}
