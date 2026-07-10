/**
 * Prefix a root-absolute public path (e.g. "/examples/images/x.jpg") with the
 * app base URL so runtime/JSON paths work under a stage prefix (e.g. "/app/").
 * Vite's `base` only rewrites build-time asset references, not runtime strings.
 */
export function publicAsset(path: string): string {
  if (/^([a-z]+:)?\/\//i.test(path) || path.startsWith("data:")) {
    return path; // leave absolute/data URLs untouched
  }
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${normalizedBase}${normalizedPath}`;
}
