export type AuthType = "password" | "privateKey";
export type DeploymentStatus = "success" | "failed" | "cancelled";
export type DeploymentPhase = "idle" | "validating" | "building" | "scanning_output" | "cleaning_remote" | "uploading" | "completed" | "failed" | "cancelled";
export type FieldErrors = Partial<Record<keyof ServerConfig | keyof ProjectConfig, string>>;

export interface ServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: AuthType;
  password?: string;
  privateKeyPath?: string;
  privateKeyPassphrase?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeploymentSummary {
  id: string;
  startedAt: string;
  finishedAt?: string;
  status: DeploymentStatus;
  filesUploaded: number;
  errorMessage?: string;
}

export interface ProjectConfig {
  id: string;
  name: string;
  rootPath: string;
  buildCommand: string;
  outputDirectory: string;
  serverId: string;
  remotePath: string;
  cleanRemoteBeforeDeploy: boolean;
  lastDeployment?: DeploymentSummary;
}

export interface DeploymentEvent {
  deploymentId: string;
  projectId: string;
  timestamp: string;
}
