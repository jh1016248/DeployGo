import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import { configClient } from "./tauri";

describe("configClient", () => {
  beforeEach(() => invoke.mockReset());
  it("sends a server payload to the save command", async () => {
    invoke.mockResolvedValue(undefined);
    await configClient.saveServer({ id: "server-1", name: "Production" });
    expect(invoke).toHaveBeenCalledWith("save_server", { server: { id: "server-1", name: "Production" } });
  });
});
