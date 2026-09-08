import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const eventMocks = vi.hoisted(() => ({ onProgress: undefined as ((event: { payload: unknown }) => void) | undefined, listen: vi.fn(async (event: string, callback: (event: { payload: unknown }) => void) => { if (event === "deployment://progress") eventMocks.onProgress = callback; return () => undefined; }) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: eventMocks.listen }));
import { useDeploymentEvents } from "./use-deployment-events";

describe("useDeploymentEvents", () => {
  beforeEach(() => { Object.defineProperty(window, "__TAURI_INTERNALS__", { value: {}, configurable: true }); eventMocks.listen.mockClear(); eventMocks.onProgress = undefined; });
  it("records progress emitted for a deployment", async () => {
    const { result } = renderHook(() => useDeploymentEvents());
    await vi.waitFor(() => expect(eventMocks.onProgress).toBeDefined());
    act(() => eventMocks.onProgress?.({ payload: { deploymentId: "d-1", projectId: "p-1", data: { phase: "uploading", percent: 68 } } }));
    expect(result.current.progress["d-1"]?.percent).toBe(68);
  });
});
