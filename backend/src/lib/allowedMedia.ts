/**
 * Hosts the backend is willing to fetch audio from. The stream proxy and the playlist schema both
 * use it, so the proxy can never be turned into an open relay (SSRF): only https URLs on
 * Apple-owned domains (iTunes previews and artwork) pass.
 */
const ALLOWED_SUFFIXES = [".apple.com", ".mzstatic.com"];

export function isAllowedMediaUrl(value: string | URL): boolean {
  let url: URL;
  try {
    url = value instanceof URL ? value : new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== "443") return false;

  const host = url.hostname.toLowerCase();
  // The leading dot matters: "evilapple.com" and "apple.com.evil.com" do not match.
  return ALLOWED_SUFFIXES.some((suffix) => host.endsWith(suffix));
}
