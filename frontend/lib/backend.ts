/**
 * Returns the backend base URL, falling back to window.location.hostname
 * if NEXT_PUBLIC_BACKEND_URL is missing or malformed (e.g. "http://:8000"
 * produced when the env var was set with an empty IP at build time).
 */
export function getBackend(): string {
  const env = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (env && !/^https?:\/\/:/i.test(env)) return env;
  if (typeof window !== "undefined") return `http://${window.location.hostname}:8000`;
  return "http://localhost:8000";
}
