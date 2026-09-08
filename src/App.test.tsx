import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

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
