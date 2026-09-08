# DeployGo

DeployGo is a Tauri desktop utility for the front-end workflow: build a project locally, then upload its output to a configured SSH target over SFTP.

## Current MVP capabilities

- Save SSH targets with password or private-key authentication. SSH connection/authentication uses a 10-second TCP/read/write timeout.
- Inspect a local package.json, select a package script/output directory, and save a deployable project.
- Run configured builds, validate the output directory, recursively upload over SFTP, show deployment progress/log events, and cancel active work.
- Default to incremental overwrite. Per-project remote cleanup is opt-in; cancellation during cleanup can leave a remote directory partially cleared and never rolls changes back.
- Send a native operating-system notification after a successful deployment.

## Prerequisites

- Node.js 20+ and pnpm 10+
- Rust stable toolchain (cargo, rustc, clippy)
- macOS: Xcode Command Line Tools. Windows: Microsoft C++ Build Tools and WebView2.

## Run

    pnpm install
    pnpm tauri dev

## Verify

    pnpm test
    pnpm build
    rustup run stable cargo test --manifest-path src-tauri/Cargo.toml
    rustup run stable cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings

## Build a desktop bundle

    pnpm tauri build

The output path and actual installer size are platform dependent. Verify bundle size on each target platform before release; no size claim is made until the installer artifact has been inspected.

## Credential storage warning

At the current user-approved MVP setting, password and optional private-key passphrase values are persisted in plaintext in the app-private Tauri Store file under the OS application-data directory. They are redacted from application logs and error messages. Do not use this option on an untrusted device. Moving credentials into macOS Keychain / Windows Credential Manager is planned for a later release.

## Deployment safety

- SSH and SFTP connection work uses a 10-second timeout.
- Only one active deployment may run for a project.
- Cancellation is available for validation, build, output scan, remote cleanup, and upload; it will not automatically roll back files already changed remotely.
- Test SSH settings before saving a server target.

## Tests without production SSH

Unit and integration tests do not contact a live host. Before production rollout, run a manual smoke deployment against a disposable SSH/SFTP target with both password and private-key authentication.
