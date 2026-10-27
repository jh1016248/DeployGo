const pad = (value: number) => String(value).padStart(2, "0");
const render = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;

/**
 * Formats a stored deployment timestamp for display in the local time zone.
 * Accepts unix seconds/milliseconds (written by the Rust backend) and ISO strings.
 */
export function formatDeployTime(value?: string): string {
  if (!value) return "尚未部署";
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    const numeric = Number(trimmed);
    const milliseconds = trimmed.length >= 12 ? numeric : numeric * 1000;
    const fromEpoch = new Date(milliseconds);
    return Number.isNaN(fromEpoch.getTime()) ? value : render(fromEpoch);
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return value;
  return render(date);
}
