import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

export type DeploymentProgress = { phase: string; percent?: number; file?: string; completedFiles?: number; totalFiles?: number };
export type DeploymentLog = { level: "info" | "success" | "warning" | "error"; message: string };
type Envelope<T> = { deploymentId: string; projectId: string; data: T };

export function useDeploymentEvents() {
  const [progress, setProgress] = useState<Record<string, DeploymentProgress>>({});
  const [logs, setLogs] = useState<Record<string, DeploymentLog[]>>({});
  const [completed, setCompleted] = useState<Record<string, { status: string; filesUploaded?: number; errorMessage?: string }>>({});
  useEffect(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
    let disposed = false; let unlisten: UnlistenFn[] = [];
    const register = async () => {
      unlisten = await Promise.all([
        listen<Envelope<DeploymentProgress>>("deployment://progress", ({ payload }) => setProgress((current) => ({ ...current, [payload.deploymentId]: payload.data }))),
        listen<Envelope<DeploymentLog>>("deployment://log", ({ payload }) => setLogs((current) => ({ ...current, [payload.deploymentId]: [...(current[payload.deploymentId] ?? []), payload.data] }))),
        listen<Envelope<{ status: string; filesUploaded?: number; errorMessage?: string }>>("deployment://complete", ({ payload }) => setCompleted((current) => ({ ...current, [payload.deploymentId]: payload.data }))),
      ]);
      if (disposed) unlisten.forEach((stop) => stop());
    };
    void register();
    return () => { disposed = true; unlisten.forEach((stop) => stop()); };
  }, []);
  return { progress, logs, completed };
}
