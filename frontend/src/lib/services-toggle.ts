const ALL_SERVICES = ["Exchange", "SharePoint", "Skype"] as const;
type ServiceName = typeof ALL_SERVICES[number];

/**
 * Compute the next service selection set after a toggle action.
 * Prevents deselecting the last remaining service.
 */
export function toggleService(
  prev: Set<ServiceName>,
  service: ServiceName,
  checked: boolean
): Set<ServiceName> {
  if (!checked && prev.size === 1) return prev;
  const next = new Set(prev);
  if (checked) {
    next.add(service);
  } else {
    next.delete(service);
  }
  return next;
}
