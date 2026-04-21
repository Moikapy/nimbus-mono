/**
 * Anonymous user fingerprint for free tier tracking.
 * Generates and persists a UUID in localStorage.
 */

const ANON_KEY = "nimbus_anon_id";

function uuid(): string {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16),
  );
}

/** Get or create an anonymous ID */
export function getAnonId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(ANON_KEY);
  if (!id) {
    id = `anon:${uuid()}`;
    localStorage.setItem(ANON_KEY, id);
  }
  return id;
}

/** Replace anonymous ID with real Clerk ID after sign-in */
export function upgradeAnonId(clerkId: string): void {
  localStorage.removeItem(ANON_KEY);
  // The agent will now receive the Clerk userId instead
}
