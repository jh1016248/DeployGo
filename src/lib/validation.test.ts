import { describe, expect, it } from "vitest";
import { DEFAULT_PORT, EMPTY_SERVER } from "./constants";
import { validateProject, validateServer } from "./validation";

describe("server validation", () => {
  it("defaults new servers to port 22", () => {
    expect(DEFAULT_PORT).toBe(22);
    expect(EMPTY_SERVER.port).toBe(22);
  });

  it("requires the private key path for private-key authentication", () => {
    expect(validateServer({ ...EMPTY_SERVER, authType: "privateKey" })).toEqual({
      name: "请输入服务器名称",
      host: "请输入 IP 地址",
      username: "请输入用户名",
      privateKeyPath: "请选择私钥文件",
      deploymentPath: "请输入部署路径",
    });
  });

  it("rejects ports outside the TCP range", () => {
    expect(validateServer({
      ...EMPTY_SERVER,
      name: "Production", host: "192.168.1.1", username: "root",
      authType: "password", password: "secret", deploymentPath: "/var/www", port: 65536,
    })).toEqual({ port: "端口必须在 1 到 65535 之间" });
  });
});

describe("project validation", () => {
  it("rejects a project using a server that is not available", () => {
    expect(validateProject({
      id: "project-1", name: "Web", rootPath: "/tmp/web", buildCommand: "pnpm build",
      outputDirectory: "dist", serverId: "missing", remotePath: "/var/www", cleanRemoteBeforeDeploy: false,
    }, [])).toEqual({ serverId: "请选择服务器" });
  });
});
