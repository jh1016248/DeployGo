import { formatDeployTime } from "./datetime";

test("shows a placeholder when there is no deployment time", () => {
  expect(formatDeployTime(undefined)).toBe("尚未部署");
  expect(formatDeployTime("")).toBe("尚未部署");
});

test("formats an ISO timestamp without milliseconds or timezone markers", () => {
  const formatted = formatDeployTime("2026-10-27T05:47:05.123Z");
  expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  expect(formatted).not.toContain("T");
  expect(formatted).not.toContain("Z");
  expect(formatted).not.toContain("."); 
});

test("falls back to the raw value when the timestamp cannot be parsed", () => {
  expect(formatDeployTime("not-a-date")).toBe("not-a-date");
});

test("formats unix second timestamps stored by the Rust backend", () => {
  const seconds = 1793160000;
  const expected = new Date(seconds * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  const rendered = `${expected.getFullYear()}-${pad(expected.getMonth() + 1)}-${pad(expected.getDate())} ${pad(expected.getHours())}:${pad(expected.getMinutes())}`;
  expect(formatDeployTime(String(seconds))).toBe(rendered);
  expect(formatDeployTime(String(seconds))).not.toBe(String(seconds));
});

test("formats unix millisecond timestamps", () => {
  const millis = 1793160000123;
  expect(formatDeployTime(String(millis))).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  expect(formatDeployTime(String(millis))).not.toBe(String(millis));
});
