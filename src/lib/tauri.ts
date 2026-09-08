import { invoke } from "@tauri-apps/api/core";
import type { ProjectConfig, ServerConfig } from "./types";

export type StoredConfigs = { servers: ServerConfig[]; projects: ProjectConfig[] };

export const configClient = {
  get: () => invoke<StoredConfigs>("get_configs"),
  saveServer: (server: unknown) => invoke<void>("save_server", { server }),
  deleteServer: (id: string) => invoke<void>("delete_server", { id }),
  saveProject: (project: unknown) => invoke<void>("save_project", { project }),
  deleteProject: (id: string) => invoke<void>("delete_project", { id }),
  inspectProject: (rootPath: string) => invoke<{ scripts: Record<string, string>; outputCandidates: string[]; hasPnpmWorkspace: boolean }>("inspect_project", { rootPath }),
  pickProjectDirectory: () => invoke<string | null>("pick_project_directory"),
  pickPrivateKey: () => invoke<string | null>("pick_private_key"),
  testConnection: (server: unknown) => invoke<void>("test_ssh_connection", { server }),
};

export const deploymentClient = {
  start: (projectId: string) => invoke<string>("start_deployment", { projectId }),
  cancel: (deploymentId: string) => invoke<void>("cancel_deployment", { deploymentId }),
};
