import type { FieldErrors, ProjectConfig, ServerConfig } from "./types";

const required = (value: string | undefined, message: string) => value?.trim() ? undefined : message;

export function validateServer(server: ServerConfig): FieldErrors {
  const errors: FieldErrors = {};
  const fields: Array<[keyof ServerConfig, string | undefined, string]> = [
    ["name", server.name, "请输入服务器名称"],
    ["host", server.host, "请输入 IP 地址"],
    ["username", server.username, "请输入用户名"],
    ["deploymentPath", server.deploymentPath, "请输入部署路径"],
  ];
  for (const [field, value, message] of fields) {
    const error = required(value, message);
    if (error) errors[field] = error;
  }
  if (!Number.isInteger(server.port) || server.port < 1 || server.port > 65535) errors.port = "端口必须在 1 到 65535 之间";
  if (server.authType === "password") {
    const error = required(server.password, "请输入密码");
    if (error) errors.password = error;
  } else {
    const error = required(server.privateKeyPath, "请选择私钥文件");
    if (error) errors.privateKeyPath = error;
  }
  return errors;
}

export function validateProject(project: ProjectConfig, servers: ServerConfig[]): FieldErrors {
  const errors: FieldErrors = {};
  const fields: Array<[keyof ProjectConfig, string, string]> = [
    ["name", project.name, "请输入项目名称"],
    ["rootPath", project.rootPath, "请选择项目文件夹"],
    ["buildCommand", project.buildCommand, "请输入打包命令"],
    ["outputDirectory", project.outputDirectory, "请输入输出目录"],
    ["remotePath", project.remotePath, "请输入远程目录"],
  ];
  for (const [field, value, message] of fields) {
    const error = required(value, message);
    if (error) errors[field] = error;
  }
  if (!project.serverId || !servers.some((server) => server.id === project.serverId)) errors.serverId = "请选择服务器";
  return errors;
}
