# DeployGo test guide

Run frontend checks with `pnpm test` and `pnpm build`. Run Rust checks through `rustup run stable cargo test --manifest-path src-tauri/Cargo.toml` and `rustup run stable cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`.

For an end-to-end smoke test, use a disposable SSH server: create a small project with an output directory, test the connection, deploy with incremental overwrite, then repeat with remote cleanup enabled. Confirm successful upload, cancellation behavior in each stage, and redaction of credentials in all logs. Never run integration tests against a production server.
