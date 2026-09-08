# DeployGo MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Build a cross-platform Tauri desktop tool that lets developers configure front-end projects and SSH servers, build locally, and deploy output via SFTP with live feedback and cancellation.

**Architecture:** The React renderer owns state, drawers, cards, logs, and Tauri event subscriptions. Rust owns persisted configuration, native dialogs, project inspection, process orchestration, SSH/SFTP, cancellation, and notifications. Store configuration in the application data directory; run synchronous ssh2 work on a blocking thread and communicate through typed Tauri commands/events.

**Tech Stack:** Tauri v2, Rust, Tokio, ssh2, tokio-util CancellationToken, React, TypeScript, Vite, pnpm, shadcn/ui, Tailwind CSS, Vitest, React Testing Library, tauri-plugin-store, tauri-plugin-dialog, tauri-plugin-notification.

**Spec:** docs/superpowers/specs/2026-05-08-deploygo-mvp-design.md

## Global Constraints

- Target macOS and Windows through Tauri v2.
- Use pnpm for the app workspace.
- Store configuration in the OS application-data directory, never in a managed project root.
- Store passwords and optional private-key passphrases in plaintext only because the user explicitly accepted that MVP trade-off; disclose it in the UI and redact all logs/errors/events.
- Set SSH connection and authentication timeout to exactly 10 seconds.
- Default remote strategy is incremental overwrite; remote cleanup is opt-in and requires UI confirmation.
- Every non-terminal deployment phase must support cancellation. No automatic remote rollback.
- All production behavior starts with a focused failing test and is verified green before continuing.

---

### Task 1: Initialize the Tauri workspace and test runners

**Files:**
- Create: package.json, pnpm-workspace.yaml, vite.config.ts, tsconfig.json, index.html
- Create: src-tauri/Cargo.toml, src-tauri/build.rs, src-tauri/tauri.conf.json, src-tauri/capabilities/default.json
- Create: src-tauri/src/main.rs, src-tauri/src/lib.rs
- Create: src/test/setup.ts, src/App.test.tsx

**Interfaces:**
- Produces the pnpm scripts dev, build, test, and tauri plus a minimal Rust library entry point named run.

- [ ] **Step 1: Write the failing renderer smoke test**

```tsx
import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders the DeployGo application shell", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "项目" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: pnpm test src/App.test.tsx
Expected: FAIL because the workspace and App module do not exist.

- [ ] **Step 3: Scaffold Tauri, Vite, Tailwind, shadcn prerequisites, and a minimal App**

```tsx
export default function App() {
  return <main><h1>项目</h1></main>;
}
```

Configure the Tauri build beforeDevCommand as pnpm dev and beforeBuildCommand as pnpm build. Keep main.rs as a thin call to the Rust library run function.

- [ ] **Step 4: Run renderer and Rust checks**

Run: pnpm test src/App.test.tsx && pnpm build && cargo check --manifest-path src-tauri/Cargo.toml
Expected: PASS, production renderer builds, and Rust library compiles.

- [ ] **Step 5: Commit**

Run: git add package.json pnpm-lock.yaml pnpm-workspace.yaml vite.config.ts tsconfig.json index.html src src-tauri && git commit -m "chore: initialize DeployGo Tauri workspace"

### Task 2: Define shared domain types and frontend validation

**Files:**
- Create: src/lib/types.ts, src/lib/validation.ts, src/lib/validation.test.ts
- Create: src/lib/constants.ts

**Interfaces:**
- Produces ServerConfig, ProjectConfig, DeploymentSummary, AuthType, DeploymentPhase, DeploymentStatus, and DeploymentEvent types.
- Produces validateServer(input): FieldErrors and validateProject(input, servers): FieldErrors.

- [ ] **Step 1: Write failing validation tests**

```ts
test("requires credentials for the selected authentication type", () => {
  expect(validateServer({ ...server, authType: "privateKey", privateKeyPath: "" }))
    .toEqual({ privateKeyPath: "请选择私钥文件" });
});

test("rejects an unavailable server from a project", () => {
  expect(validateProject(project, [])).toEqual({ serverId: "请选择服务器" });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: pnpm test src/lib/validation.test.ts
Expected: FAIL because validation module is missing.

- [ ] **Step 3: Implement types, constants, and minimal validation**

Validate host, username, port 1–65535, deployment path, root path, build command, output directory, server selection, and only the active authentication method's required values. Set port 22 and cleanRemoteBeforeDeploy false as defaults.

- [ ] **Step 4: Run tests to verify green**

Run: pnpm test src/lib/validation.test.ts
Expected: PASS.

- [ ] **Step 5: Commit**

Run: git add src/lib && git commit -m "feat: add deployment configuration domain models"

### Task 3: Add Rust error, configuration repository, and commands

**Files:**
- Create: src-tauri/src/models.rs, src-tauri/src/error.rs, src-tauri/src/store.rs
- Create: src-tauri/src/commands/config.rs
- Modify: src-tauri/src/lib.rs, src-tauri/Cargo.toml, src-tauri/capabilities/default.json
- Test: src-tauri/src/store.rs unit-test module

**Interfaces:**
- Produces Rust serializable ServerConfig, ProjectConfig, DeploymentSummary, AppConfig.
- Produces AppStore methods load, save_server, delete_server, save_project, delete_project.
- Produces commands get_configs, save_server, delete_server, save_project, delete_project.

- [ ] **Step 1: Write failing repository tests**

```rust
#[test]
fn deleting_a_referenced_server_returns_project_names() {
    let store = seeded_store();
    let result = store.delete_server("srv-1");
    assert_eq!(result.unwrap_err().message(), "服务器正在被项目 Web 使用，无法删除");
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: cargo test --manifest-path src-tauri/Cargo.toml store::tests::deleting_a_referenced_server_returns_project_names
Expected: FAIL because repository API is absent.

- [ ] **Step 3: Implement store-backed configuration operations**

Use tauri-plugin-store with application-data resolution. Return structured AppError values; never serialize password/passphrase in error text. Register commands in generate_handler and add only the store permissions required by default capability.

- [ ] **Step 4: Run Rust tests and type checks**

Run: cargo test --manifest-path src-tauri/Cargo.toml && cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
Expected: PASS without warnings.

- [ ] **Step 5: Commit**

Run: git add src-tauri && git commit -m "feat: persist server and project configurations"

### Task 4: Implement safe local project inspection and native selection

**Files:**
- Create: src-tauri/src/inspect.rs, src-tauri/src/commands/project.rs
- Modify: src-tauri/src/lib.rs, src-tauri/Cargo.toml, src-tauri/capabilities/default.json
- Test: src-tauri/src/inspect.rs unit-test module

**Interfaces:**
- Produces inspect_project(root_path: String) returning scripts, outputCandidates, and hasPnpmWorkspace.
- Produces pick_project_directory and pick_private_key commands.

- [ ] **Step 1: Write failing inspection tests**

```rust
#[test]
fn lists_scripts_and_existing_dist_candidate() {
    let result = inspect_project(fixture_path("vite-project")).unwrap();
    assert!(result.scripts.contains_key("build"));
    assert!(result.output_candidates.contains(&"dist".to_string()));
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: cargo test --manifest-path src-tauri/Cargo.toml inspect::tests::lists_scripts_and_existing_dist_candidate
Expected: FAIL because inspection implementation is missing.

- [ ] **Step 3: Implement inspection and dialogs**

Parse only root package.json, use serde_json, detect actual dist/build/out folders, and set hasPnpmWorkspace only when root pnpm-workspace.yaml exists. Use tauri-plugin-dialog for selectors and explicitly grant dialog capability.

- [ ] **Step 4: Run tests and lint**

Run: cargo test --manifest-path src-tauri/Cargo.toml && cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
Expected: PASS.

- [ ] **Step 5: Commit**

Run: git add src-tauri && git commit -m "feat: inspect local deployment projects"

### Task 5: Build deployment state and every-phase cancellation core

**Files:**
- Create: src-tauri/src/deploy/types.rs, src-tauri/src/deploy/registry.rs, src-tauri/src/deploy/mod.rs
- Modify: src-tauri/src/lib.rs, src-tauri/Cargo.toml
- Test: src-tauri/src/deploy/registry.rs unit-test module

**Interfaces:**
- Produces DeploymentPhase, DeploymentProgress, DeploymentLog, DeploymentComplete.
- Produces DeploymentRegistry::start, token, set_child, cancel, finish.
- Produces cancellation_point(token): Result<(), AppError>.

- [ ] **Step 1: Write failing cancellation tests**

```rust
#[tokio::test]
async fn cancel_marks_active_deployment_and_cancellation_point_stops_work() {
    let registry = DeploymentRegistry::default();
    let id = registry.start("project-1".into()).await.unwrap();
    registry.cancel(&id).await.unwrap();
    assert!(cancellation_point(registry.token(&id).await.unwrap()).is_err());
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: cargo test --manifest-path src-tauri/Cargo.toml deploy::registry::tests::cancel_marks_active_deployment
Expected: FAIL because registry does not exist.

- [ ] **Step 3: Implement thread-safe task registry**

Use tokio-util CancellationToken and async Mutex state. Enforce one active deployment per project, track optional child process ID, ensure finish removes registry state, and use a single cancellation error variant that maps to cancelled rather than failed.

- [ ] **Step 4: Run tests and clippy**

Run: cargo test --manifest-path src-tauri/Cargo.toml && cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
Expected: PASS.

- [ ] **Step 5: Commit**

Run: git add src-tauri && git commit -m "feat: add cancellable deployment task registry"

### Task 6: Implement redacted build execution and event streaming

**Files:**
- Create: src-tauri/src/deploy/build.rs, src-tauri/src/deploy/events.rs
- Modify: src-tauri/src/deploy/mod.rs
- Test: src-tauri/src/deploy/build.rs unit-test module

**Interfaces:**
- Produces run_build(project, token, emitter): Result<(), AppError>.
- Produces emitter methods log, progress, complete, each with deployment ID and timestamp.

- [ ] **Step 1: Write failing build behavior tests**

```rust
#[tokio::test]
async fn rejects_successful_command_when_output_directory_does_not_exist() {
    let error = run_build(project_with_output("missing-dist"), token(), test_emitter()).await.unwrap_err();
    assert_eq!(error.user_message(), "构建完成，但未找到输出目录 missing-dist");
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: cargo test --manifest-path src-tauri/Cargo.toml deploy::build::tests::rejects_successful_command
Expected: FAIL because runner is missing.

- [ ] **Step 3: Implement build process orchestration**

Run configured command in project root using platform-appropriate shell invocation. Stream stdout/stderr lines with source level. Register child with registry, race read/wait against CancellationToken, terminate then force kill on cancellation, and validate output root only after a zero exit status. Redact configured secrets from every emitted message.

- [ ] **Step 4: Run focused and full Rust test suites**

Run: cargo test --manifest-path src-tauri/Cargo.toml && cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
Expected: PASS.

- [ ] **Step 5: Commit**

Run: git add src-tauri && git commit -m "feat: stream cancellable build output"

### Task 7: Implement 10-second SSH test and SFTP transport

**Files:**
- Create: src-tauri/src/ssh.rs, src-tauri/src/commands/server.rs, src-tauri/src/deploy/sftp.rs
- Modify: src-tauri/src/deploy/mod.rs, src-tauri/src/lib.rs, src-tauri/Cargo.toml, src-tauri/capabilities/default.json
- Test: src-tauri/src/ssh.rs and src-tauri/src/deploy/sftp.rs unit-test modules

**Interfaces:**
- Produces test_ssh_connection(server): Result<ConnectionTest, AppError>.
- Produces upload_output(server, project, token, emitter): Result<UploadSummary, AppError>.
- Produces clean_remote_if_requested(server, project, token, emitter): Result<(), AppError>.

- [ ] **Step 1: Write failing transport tests**

```rust
#[test]
fn normalizes_remote_path_without_duplicate_separators() {
    assert_eq!(normalize_remote_path("/var/www/", "/assets/"), "/var/www/assets");
}

#[test]
fn redacts_password_from_connection_error() {
    assert!(!friendly_connection_error("auth failed: super-secret", &["super-secret"]).contains("super-secret"));
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: cargo test --manifest-path src-tauri/Cargo.toml ssh::tests
Expected: FAIL because transport helpers are missing.

- [ ] **Step 3: Implement SSH and SFTP**

Set TCP connect/read/write timeout to 10 seconds. Support password and private-key authentication. Execute session work in spawn_blocking. Scan local output to establish total files; recursively mkdir remote paths and upload streams in bounded chunks. If cleanup is enabled, emit warning then recursively remove remote entries. Check cancellation before connection, authentication, traversal entry, each deletion, each directory create, each file, and each transfer chunk. Closing session is the cancellation cleanup mechanism.

- [ ] **Step 4: Run tests, clippy, and an opt-in local SSH integration check**

Run: cargo test --manifest-path src-tauri/Cargo.toml && cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
Expected: PASS. Add a documented integration command gated by DEPLOYGO_TEST_SSH_HOST so no live network test runs by default.

- [ ] **Step 5: Commit**

Run: git add src-tauri && git commit -m "feat: test SSH and upload outputs over SFTP"

### Task 8: Compose deployment commands and persist final summaries

**Files:**
- Create: src-tauri/src/commands/deploy.rs
- Modify: src-tauri/src/deploy/mod.rs, src-tauri/src/store.rs, src-tauri/src/lib.rs
- Test: src-tauri/src/commands/deploy.rs unit-test module

**Interfaces:**
- Produces start_deployment(project_id): Result<DeploymentStarted, AppError> and cancel_deployment(deployment_id): Result<(), AppError>.
- Produces final summary update for success, failed, and cancelled outcomes.

- [ ] **Step 1: Write failing orchestration tests**

```rust
#[tokio::test]
async fn cancelled_deploy_persists_cancelled_summary_and_emits_completion() {
    let result = complete_cancelled_deployment(test_context()).await;
    assert_eq!(result.summary.status, DeploymentStatus::Cancelled);
    assert!(result.events.contains_complete_with_status(DeploymentStatus::Cancelled));
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: cargo test --manifest-path src-tauri/Cargo.toml commands::deploy::tests::cancelled_deploy
Expected: FAIL because orchestration is missing.

- [ ] **Step 3: Implement orchestration**

Load and validate configs, immediately return a deployment ID, spawn workflow, emit validating/building/scanning/cleaning/uploading progress, convert cancellation into terminal cancelled state, persist a last-deployment summary for all outcomes, and emit exactly one completion event. Register start/cancel commands and notification permissions.

- [ ] **Step 4: Run Rust verification**

Run: cargo test --manifest-path src-tauri/Cargo.toml && cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
Expected: PASS.

- [ ] **Step 5: Commit**

Run: git add src-tauri && git commit -m "feat: orchestrate one-click deployments"

### Task 9: Build app state, typed Tauri client, and navigation shell

**Files:**
- Create: src/lib/tauri.ts, src/hooks/use-configs.ts, src/hooks/use-deployments.ts
- Create: src/components/app-shell.tsx, src/components/sidebar.tsx, src/components/ui/*
- Modify: src/App.tsx, src/App.test.tsx
- Test: src/components/app-shell.test.tsx

**Interfaces:**
- Produces typed invoke wrappers and event subscription cleanup.
- Produces AppShell with Projects and Servers navigation and selected-page state.

- [ ] **Step 1: Write failing shell interaction test**

```tsx
test("switches from projects to servers navigation", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("link", { name: "服务器" }));
  expect(screen.getByRole("heading", { name: "服务器" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: pnpm test src/components/app-shell.test.tsx
Expected: FAIL because navigation shell is absent.

- [ ] **Step 3: Implement typed data hooks and accessible shell**

Use TanStack Query or a minimal focused store for config cache; subscribe to events with cleanup on unmount. Provide semantic navigation, keyboard focus behavior, and responsive desktop layout. Configure the initial dark visual tokens and shadcn primitives.

- [ ] **Step 4: Run frontend tests and production build**

Run: pnpm test && pnpm build
Expected: PASS.

- [ ] **Step 5: Commit**

Run: git add src && git commit -m "feat: add DeployGo application shell"

### Task 10: Implement server list, drawer, connection test, and destructive guard

**Files:**
- Create: src/features/servers/server-list.tsx, server-form-drawer.tsx, server-form.tsx
- Modify: src/App.tsx
- Test: src/features/servers/server-form.test.tsx, server-list.test.tsx

**Interfaces:**
- Consumes typed configuration client and validateServer.
- Produces save/delete/test connection interactions with clear pending/success/error UI states.

- [ ] **Step 1: Write failing server UI tests**

```tsx
test("shows private-key validation after selecting private-key auth", async () => {
  render(<ServerForm onSave={vi.fn()} />);
  await userEvent.click(screen.getByLabelText("私钥认证"));
  await userEvent.click(screen.getByRole("button", { name: "保存服务器" }));
  expect(screen.getByText("请选择私钥文件")).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: pnpm test src/features/servers/server-form.test.tsx
Expected: FAIL because server UI is absent.

- [ ] **Step 3: Implement server management UI**

Add server list, add/edit drawer, authentication selector, native private-key picker, Test connection progress state, plaintext persistence disclosure, mapped timeout/auth/key errors, save actions, and delete modal that displays backend-reported references.

- [ ] **Step 4: Run frontend verification**

Run: pnpm test && pnpm build
Expected: PASS.

- [ ] **Step 5: Commit**

Run: git add src && git commit -m "feat: manage and test SSH servers"

### Task 11: Implement project cards and project add/edit workflow

**Files:**
- Create: src/features/projects/project-grid.tsx, project-card.tsx, project-form-drawer.tsx, project-form.tsx, empty-state.tsx
- Modify: src/App.tsx
- Test: src/features/projects/project-form.test.tsx, project-card.test.tsx

**Interfaces:**
- Consumes inspect_project response, server list, validateProject, and configuration client.
- Produces project CRUD and deploy-ready cards.

- [ ] **Step 1: Write failing project workflow test**

```tsx
test("fills script suggestions after selecting project folder", async () => {
  mockInspectProject.mockResolvedValue({ scripts: { "build:prod": "vite build" }, outputCandidates: ["dist"] });
  render(<ProjectForm servers={[server]} onSave={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "选择项目文件夹" }));
  expect(await screen.findByRole("option", { name: "build:prod" })).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: pnpm test src/features/projects/project-form.test.tsx
Expected: FAIL because project workflow is absent.

- [ ] **Step 3: Implement projects UI**

Implement first-run empty state, responsive cards, native root picker, inspection suggestions, custom command/output override, server picker, opt-in cleanup switch with confirmation text, edit/delete actions, last-deployment rendering, and project validation.

- [ ] **Step 4: Run frontend verification**

Run: pnpm test && pnpm build
Expected: PASS.

- [ ] **Step 5: Commit**

Run: git add src && git commit -m "feat: configure deployable frontend projects"

### Task 12: Implement live deployment display, logs, progress, cancellation, and notifications feedback

**Files:**
- Create: src/features/deployment/use-deployment-events.ts, deployment-log-panel.tsx, deployment-progress.tsx
- Modify: src/features/projects/project-card.tsx, src/hooks/use-deployments.ts
- Test: src/features/deployment/deployment-log-panel.test.tsx, src/features/projects/project-card.test.tsx

**Interfaces:**
- Consumes deployment log/progress/complete event payloads.
- Produces card-level phase/progress/cancel state and log panel auto-follow behavior.

- [ ] **Step 1: Write failing live-state tests**

```tsx
test("keeps cancel available during remote cleanup", () => {
  render(<ProjectCard project={project} deployment={{ phase: "cleaning_remote", percent: 54 }} />);
  expect(screen.getByRole("button", { name: "取消部署" })).toBeEnabled();
  expect(screen.getByText("正在清空远程目录")).toBeVisible();
});

test("renders error logs with label and semantic styling", () => {
  render(<DeploymentLogPanel logs={[{ level: "error", message: "上传失败" }]} />);
  expect(screen.getByText("错误")).toBeVisible();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: pnpm test src/features/deployment/deployment-log-panel.test.tsx src/features/projects/project-card.test.tsx
Expected: FAIL because live deployment UI is absent.

- [ ] **Step 3: Implement event-driven deployment UI**

Start deployment from card, disable only duplicate start for active project, map every phase to visible text, show file/count progress, keep Cancel always enabled in active phases, open bottom log panel automatically, support pause-follow after manual scroll and jump-to-latest, render semantic log labels/colors, handle terminal toast and clear active state. Rely on Rust for operating-system notification but show renderer fallback toast if permission fails.

- [ ] **Step 4: Run frontend checks**

Run: pnpm test && pnpm build
Expected: PASS.

- [ ] **Step 5: Commit**

Run: git add src && git commit -m "feat: show live deployment progress and cancellation"

### Task 13: Verify packaging, permissions, quality, and documentation

**Files:**
- Create: README.md, docs/testing.md
- Modify: src-tauri/tauri.conf.json, src-tauri/capabilities/default.json
- Modify: package.json

**Interfaces:**
- Produces documented setup, test, optional SSH integration, security trade-off, and packaging instructions.

- [ ] **Step 1: Write failing documentation assertion**

```ts
test("README documents plaintext credential risk and cancellation limits", async () => {
  const readme = await fs.readFile("README.md", "utf8");
  expect(readme).toContain("明文");
  expect(readme).toContain("不会自动回滚");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: pnpm test src/docs/readme.test.ts
Expected: FAIL because README and test do not exist.

- [ ] **Step 3: Document operational requirements and finish configuration**

Document required Node/Rust prerequisites, dev command, production bundle command, configuration location, plaintext credential risk, cleanup/cancellation warning, 10-second timeout, supported auth methods, and opt-in integration test environment variables. Review Tauri capability permissions against actual plugin usage and remove unused grants.

- [ ] **Step 4: Run complete verification and inspect artifact size**

Run: pnpm test && pnpm build && cargo test --manifest-path src-tauri/Cargo.toml && cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings && pnpm tauri build
Expected: all checks pass. Record generated bundle paths and their sizes, explicitly noting whether the platform-specific installer satisfies the 10 MB goal.

- [ ] **Step 5: Commit**

Run: git add README.md docs package.json src-tauri && git commit -m "docs: document DeployGo setup and deployment safety"
