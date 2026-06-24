// Helpers to round-trip between a UTC ISO instant and an <input type="datetime-local">
// value ("YYYY-MM-DDTHH:mm"), using the runtime's LOCAL timezone consistently on both ends.
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** UTC ISO instant -> local "YYYY-MM-DDTHH:mm" for a datetime-local input. Empty in -> empty out. */
export function isoToLocalInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Local "YYYY-MM-DDTHH:mm" datetime-local value -> UTC ISO instant. Empty in -> null. */
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value); // parsed as local time
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
