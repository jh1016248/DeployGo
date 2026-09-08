# DeployGo MVP Design Specification

**Status:** Proposed for final review  
**Scope:** Tauri desktop deployment tool MVP for macOS and Windows

## 1. Goal and scope

DeployGo replaces the manual front-end deployment sequence of build then SSH upload with a desktop workflow. A developer saves a local project and SSH target, then deploys from a project card while seeing live logs and upload progress.

### MVP includes

- CRUD for SSH server configurations and deployment projects.
- Password and private-key SSH authentication, with a 10-second connection timeout.
- Project inspection from package.json: scripts and common output-directory suggestions.
- Build execution, recursive SFTP upload, incremental overwrite by default, optional remote cleanup.
- Build and transfer logs, phase and file progress, cancellation in every active phase, final status persistence, and system notification.

### Deferred to phase 2

- Automatic monorepo workspace project creation from pnpm-workspace.yaml.
- Full queryable deployment history and commit hash collection.
- SQLite migration, encrypted/system-keychain credential store, atomic release directory switching, and upload retry/resume.

## 2. Architecture

The app uses Tauri v2 with a React + TypeScript renderer and a Rust application core. shadcn/ui supplies accessible primitives styled into a dark developer-oriented interface. Tauri IPC keeps filesystem, process, SSH/SFTP, and notification access in Rust.

React renderer invokes commands for configuration, inspection, test, deploy, and cancellation; it listens for deployment log, progress, and completion events. The Rust core uses tauri-plugin-store for configuration, tokio process handling for the build child and stdout/stderr streaming, ssh2 inside spawn_blocking for SSH and SFTP work, a CancellationToken registry keyed by deployment ID, and the notification plugin for successful deploys.

ssh2 is synchronous. Its connection and SFTP work runs inside tokio task spawn_blocking, while Tauri commands return promptly and events keep the renderer responsive. Rust lib.rs owns runtime logic; main.rs remains a thin entry point.

## 3. Persistence and security

Servers and projects are saved in the Tauri Store file under the OS application-data directory. The tool does not create or modify project-source files.

### ServerConfig

- id, name, host, port (default 22), username, authentication type
- password when password authentication is selected
- private-key local path and optional passphrase when key authentication is selected
- default deployment path, created time, updated time

### ProjectConfig

- id, name, local root path, build command, output directory relative to root
- server ID, remote path, cleanRemoteBeforeDeploy (default false)
- optional last-deployment summary: ID, start/end timestamps, success/failed/cancelled status, uploaded count, and error message

**Accepted MVP security trade-off:** the user explicitly requested direct plaintext persistence. Passwords and optional private-key passphrases will therefore be stored as plaintext in the app-private store file. The credential form must disclose this risk. Private-key material is never copied; only its local path is saved. Logs, toasts, errors, and events redact passwords and passphrases. A later release should move the values to macOS Keychain and Windows Credential Manager.

## 4. Commands, events, and capabilities

Every Rust command returns a Result with frontend-safe errors, is registered in the Tauri command handler, and is covered by explicit Tauri v2 capabilities.

| API | Purpose |
|---|---|
| get_configs | Return saved servers and projects. |
| save_server, delete_server | Validate/persist server settings; block deletion while referenced. |
| save_project, delete_project | Validate/persist project settings. |
| pick_project_directory, pick_private_key | Open native selectors. |
| inspect_project | Parse package.json, enumerate scripts, identify output candidates and workspace presence. |
| test_ssh_connection | Connect/authenticate using a hard 10-second timeout. |
| start_deployment | Register and start background deployment; return deployment ID. |
| cancel_deployment | Signal cancellation and terminate active build process. |

Events are deployment log, deployment progress, and deployment complete. Every payload includes deployment ID, ISO timestamp, and project ID. Log data adds info/success/warning/error level. Progress data adds phase, optional file name, completed file count, total file count, and percentage.

## 5. Deployment state machine and cancellation

Flow: idle to validating to building to scanning output to optional remote cleaning to uploading to completed; every active state may instead end in failed or cancelled.

A CancellationToken is registered before validation. The Cancel control remains available in every non-terminal phase, and all workers check the same token at phase entry and every interruptible boundary.

| Phase | Work | Cancellation behavior |
|---|---|---|
| validating | Validate local config and create SSH session. | Stop connection/auth wait and close socket/session. |
| building | Run configured command in project root. | Send termination then force-kill after a short grace period. |
| scanning output | Recursively enumerate output files. | Stop traversal immediately. |
| cleaning remote | Optional recursive remote deletion. | Check before each delete; mark cancelled and warn remote content may be partly deleted. |
| uploading | Create directories and transfer files via SFTP. | Check before each file and between chunks; close SFTP/SSH, preserving files already uploaded. |

Cancellation always persists a cancelled last-deployment status, sends completion event, restores the card action state, and avoids showing a false error. It never rolls back remote changes. Only one deployment for the same project may run at once; different project deployments may run independently.

Build stdout and stderr stream line by line as log events. After success, the output directory must exist and contain uploadable files. SFTP creates needed directories and overwrites matching remote paths. Incremental overwrite is default. Enabled cleanup requires explicit UI confirmation and logs a warning before deletion.

## 6. Frontend experience

### Shell and navigation

The desktop-first dark shell has a narrow left navigation for Projects, Servers, and settings. The main header shows the active section and context primary action. Green is action/success, yellow is warning, and red is error/destructive; each color always has a text label.

### Projects

The first-run empty state says 暂无项目 and explains that adding a local front-end project enables one-click deployment. A primary button opens the project drawer.

Cards form a responsive grid. Each shows name, status badge, local root, build command, server and target path, last result/time, Deploy, and an Edit/Delete menu. An active card shows phase, current file, progress bar, and a visible Cancel button. Only that project's normal Deploy action is disabled.

### Project drawer

1. Select a local root directory.
2. Inspect package.json and show scripts as build-command choices; keep a custom command option.
3. Suggest existing dist, build, or out folders; allow custom output directory.
4. Select server and target path.
5. Provide deploy-before-cleaning setting, off by default, with irreversible-action explanation.
6. Perform inline validation before save.

### Servers

Server rows show name, username/host/port, default deployment path, and last connection-test result. The server drawer toggles password or private-key auth, defaults port to 22, provides a 10-second Test connection state, and includes the plaintext-storage warning. Timeouts suggest checking host, port, firewall, or VPN; auth errors suggest credentials; unreadable keys identify the path. Deletion identifies and blocks on referenced projects.

### Logs, completion, and errors

A deployment opens a bottom log panel, expandable to half-screen. It shows project, phase, elapsed time, cancel control, automatic follow, manual-scroll pause, and jump to latest. Logs use both labels and colors: neutral, success green, warning yellow, error red. Finished logs stay until dismissal or another deployment starts.

Toasts provide short summary feedback. The log panel holds detailed redacted diagnostics. A successful deployment sends a system notification with project name and uploaded file count.

## 7. Validation and error policy

- Reject blank host, username, project root, build command, output directory, server assignment, or remote path.
- Require exactly the selected authentication method's fields.
- Validate port range 1–65535 and normalize remote paths.
- Resolve project root/output locally before building; never run configured shell content outside selected root.
- Map Rust failures to clear messages and retain redacted details in deployment log.
- Keep process, network, traversal, and store I/O asynchronous so renderer never blocks.

## 8. Non-functional constraints and tests

- Build for macOS and Windows with Tauri v2.
- Favor small dependencies and no bundled server runtime, targeting an installer under 10 MB where platform packaging permits. Record real artifact size at release verification.
- Target less than 100 MB steady-state memory and stream upload files in bounded chunks.
- Unit-test validation, project inspection, state transitions, error mappings, path normalization, and cancellation behavior.
- Component-test form validation and card action state.
- Use only explicit local/container SSH integration targets; never use production credentials in test.

## 9. Phase 2 migration path

Project inspection returns workspace detection metadata now, allowing monorepo project selection later without breaking callers. A deployment-history repository can migrate summaries to SQLite and record Git commit hash at deploy start. Credential storage can migrate store values into OS keychains while preserving server IDs as stable references.
