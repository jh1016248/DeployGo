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
