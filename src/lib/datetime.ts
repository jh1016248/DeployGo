const pad = (value: number) => String(value).padStart(2, "0");

/** Formats an ISO deployment timestamp for display in the local time zone. */
export function formatDeployTime(value?: string): string {
  if (!value) return "尚未部署";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
