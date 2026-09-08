import type { ProjectConfig, ServerConfig } from "./types";

export const DEFAULT_PORT = 22;

export const EMPTY_SERVER: ServerConfig = {
  id: "", name: "", host: "", port: DEFAULT_PORT, username: "",
  authType: "password", password: "", privateKeyPath: "", privateKeyPassphrase: "",
  deploymentPath: "",
};

export const EMPTY_PROJECT: ProjectConfig = {
  id: "", name: "", rootPath: "", buildCommand: "", outputDirectory: "",
  serverId: "", remotePath: "", cleanRemoteBeforeDeploy: false,
};
