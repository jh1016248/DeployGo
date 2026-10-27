import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const apiMocks = vi.hoisted(() => ({ invoke: vi.fn() }));
const eventMocks = vi.hoisted(() => ({ handlers: {} as Record<string, (event: { payload: unknown }) => void> }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: apiMocks.invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn((name: string, handler: (event: { payload: unknown }) => void) => { eventMocks.handlers[name] = handler; return Promise.resolve(() => undefined); }) }));
import { act } from "react";
import App from "./App";
import { formatDeployTime } from "./lib/datetime";

beforeEach(() => { apiMocks.invoke.mockReset(); eventMocks.handlers = {}; });
afterEach(() => { delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__; });

test("renders the DeployGo project empty state", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "项目" })).toBeInTheDocument();
  expect(screen.getByText("暂无项目")).toBeVisible();
  expect(screen.getByRole("button", { name: "添加项目" })).toBeEnabled();
});

test("switches to the server page from navigation", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "服务器" }));
  expect(screen.getByRole("heading", { name: "服务器" })).toBeVisible();
});

test("opens the project configuration form", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "添加项目" }));
  expect(screen.getByRole("heading", { name: "添加项目" })).toBeVisible();
  expect(screen.getByLabelText("打包命令")).toBeVisible();
});

test("opens the server configuration form", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "服务器" }));
  await user.click(screen.getByRole("button", { name: "添加服务器" }));
  expect(screen.getByRole("heading", { name: "添加服务器" })).toBeVisible();
  expect(screen.getByLabelText("主机地址")).toBeVisible();
});

test("tests a saved server from its card", async () => {
  const user = userEvent.setup();
  (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
  const server = { id: "srv-1", name: "生产", host: "203.0.113.10", port: 22, username: "deploy", authType: "password", password: "secret", createdAt: "2026-01-01", updatedAt: "2026-01-01" };
  apiMocks.invoke.mockImplementation((command: string) => command === "get_configs" ? Promise.resolve({ servers: [server], projects: [] }) : Promise.resolve(null));
  render(<App />);
  await user.click(screen.getByRole("button", { name: "服务器" }));
  await screen.findByText("生产");
  await user.click(screen.getByRole("button", { name: "测试连接" }));
  expect(apiMocks.invoke).toHaveBeenCalledWith("test_ssh_connection", { server });
});

test("opens a saved server in edit mode", async () => {
  const user = userEvent.setup();
  (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
  const server = { id: "srv-2", name: "预发布", host: "198.51.100.20", port: 2222, username: "release", authType: "password", password: "secret", createdAt: "2026-01-01", updatedAt: "2026-01-01" };
  apiMocks.invoke.mockImplementation((command: string) => command === "get_configs" ? Promise.resolve({ servers: [server], projects: [] }) : Promise.resolve(null));
  render(<App />);
  await user.click(screen.getByRole("button", { name: "服务器" }));
  await screen.findByText("预发布");
  await user.click(screen.getByRole("button", { name: "编辑配置" }));
  expect(screen.getByRole("heading", { name: "编辑服务器" })).toBeVisible();
  expect(screen.getByLabelText("主机地址")).toHaveValue("198.51.100.20");
});

test("opens a saved project in edit mode", async () => {
  const user = userEvent.setup();
  (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
  const server = { id: "srv-3", name: "生产", host: "203.0.113.10", port: 22, username: "deploy", authType: "password", password: "secret", createdAt: "2026-01-01", updatedAt: "2026-01-01" };
  const project = { id: "project-3", name: "官网", rootPath: "/tmp/site", buildCommand: "pnpm build", outputDirectory: "dist", serverId: "srv-3", remotePath: "/var/www/site", cleanRemoteBeforeDeploy: false };
  apiMocks.invoke.mockImplementation((command: string) => command === "get_configs" ? Promise.resolve({ servers: [server], projects: [project] }) : Promise.resolve(null));
  render(<App />);
  await screen.findByText("官网");
  await user.click(screen.getByRole("button", { name: "编辑项目" }));
  expect(screen.getByRole("heading", { name: "编辑项目" })).toBeVisible();
  expect(screen.getByLabelText("打包命令")).toHaveValue("pnpm build");
  expect(screen.getByRole("combobox")).toHaveValue("srv-3");
});
test("refreshes the project card when a deployment completes", async () => {
  (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
  const server = { id: "srv-9", name: "生产", host: "203.0.113.10", port: 22, username: "deploy", authType: "password", password: "secret", createdAt: "2026-01-01", updatedAt: "2026-01-01" };
  const before = { id: "dep-1", startedAt: "1793160000", finishedAt: "1793160000", status: "success", filesUploaded: 2 };
  const after = { id: "dep-2", startedAt: "1793250000", finishedAt: "1793250000", status: "success", filesUploaded: 3 };
  const baseProject = { id: "project-9", name: "官网", rootPath: "/tmp/site", buildCommand: "pnpm build", outputDirectory: "dist", serverId: "srv-9", remotePath: "/var/www/site", cleanRemoteBeforeDeploy: false };
  let current = { ...baseProject, lastDeployment: before };
  apiMocks.invoke.mockImplementation((command: string) => {
    if (command === "get_configs") return Promise.resolve({ servers: [server], projects: [current] });
    return Promise.resolve("dep-2");
  });
  render(<App />);
  await screen.findByText(formatDeployTime("1793160000"));
  current = { ...baseProject, lastDeployment: after };
  await act(async () => { eventMocks.handlers["deployment://complete"]?.({ payload: { deploymentId: "dep-2", projectId: "project-9", data: { status: "success" } } }); });
  await screen.findByText(formatDeployTime("1793250000"));
});
