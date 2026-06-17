/**
 * Formats an ISO 8601 timestamp for display.
 * Returns "Never" if the value is undefined or empty.
 */
export function formatDate(iso: string | undefined): string {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    return iso ?? "Never";
  }
}
