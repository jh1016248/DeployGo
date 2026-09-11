# DeployGo

DeployGo 是一个基于 **Tauri + React + Rust** 的前端项目部署桌面工具，用于把重复的“构建项目 → SSH/SFTP 上传服务器”流程变成可配置的一键发布。

适合个人开发者和小团队发布静态前端项目，不试图替代 Jenkins、GitLab CI 等完整 CI/CD 平台。

## 功能

- 保存、编辑和回显 SSH 服务器配置，支持密码和私钥认证。
- 测试 SSH 连接；连接、认证及读写操作统一使用 10 秒超时。
- 选择本地项目目录，自动识别 package.json scripts 和常见输出目录。
- 保存和编辑项目：构建命令、输出目录、关联服务器、远程目录与清理选项都会回显。
- 一键执行 pnpm build、npm run build 等构建命令，并将产物通过 SFTP 上传。
- 实时显示构建 stdout/stderr、上传目标、远程清理提示和逐文件上传日志。
- 显示部署进度；构建、扫描、远程清理和上传阶段均可取消。
- 默认增量覆盖；可选“部署前清空远程目录”。
- 部署成功后发送系统通知；日志面板可手动关闭，不会中断部署。
- macOS 打包版本通过用户登录 Shell 执行构建命令，以加载 nvm、Node.js 和 pnpm 环境。

## 使用流程

1. 在“服务器”页添加并测试 SSH 服务器。
2. 在“项目”页添加本地前端项目，选择构建命令、输出目录、服务器和远程目录。
3. 点击“部署”，在实时日志中查看构建和上传过程。

常见构建命令：

```bash
pnpm build
# 或
npm run build
```

多条命令建议用 && 连接，保证前一步成功后再继续：

```bash
git pull && pnpm build
```

## 环境要求

### 使用已打包的 macOS App

DeployGo 不内置 Node.js、npm 或 pnpm。运行项目构建前，请确保以下命令在当前用户终端可用：

```bash
node -v
pnpm -v
```

如果项目使用 npm，则确保 npm -v 能正常执行。当前发布的 aarch64 DMG 适用于 Apple Silicon Mac（M1/M2/M3/M4）。

### 本地开发

- Node.js 20+
- pnpm 10+
- Rust stable（cargo、rustc、clippy）
- macOS：Xcode Command Line Tools
- Windows：Microsoft C++ Build Tools 与 WebView2

```bash
pnpm install
pnpm tauri dev
```

## 验证与打包

```bash
# 前端测试与构建
pnpm test
pnpm build

# Rust 测试与静态检查
rustup run stable cargo test --manifest-path src-tauri/Cargo.toml
rustup run stable cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings

# 打包桌面应用
pnpm tauri build
```

## 安全与部署说明

- 当前 MVP 根据使用需求，将密码和可选私钥口令以 **明文** 保存在应用私有 Tauri Store 配置中；请仅在可信设备使用，且不要把配置文件提交到仓库。
- 密码和私钥口令不会出现在应用日志或友好错误信息中。
- 启用“部署前清空远程目录”后，远程文件删除不可恢复；中途取消也不会回滚已经删除或上传的文件。
- 建议先使用测试服务器完成一次部署，再发布到生产环境。

## 技术栈

- React + TypeScript + Vite
- Rust + Tauri v2
- ssh2：SSH/SFTP
- tauri-plugin-store：配置持久化
- tauri-plugin-dialog：目录/私钥选择
- tauri-plugin-notification：部署完成通知

## 当前限制

- 当前 macOS 安装包已验证；Windows 安装包仍需在 Windows 环境完成构建和运行验证。
- 仍建议在可丢弃的 SSH/SFTP 测试环境中完成端到端验证后再用于生产发布。
