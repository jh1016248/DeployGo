use std::{fs, time::{SystemTime, UNIX_EPOCH}};
use deploygo_lib::{deploy::build::{run_build, validate_output_directory}, models::ProjectConfig};
use tokio_util::sync::CancellationToken;

fn project(root_path: String, build_command: &str) -> ProjectConfig {
    ProjectConfig { id: "project-1".into(), name: "Web".into(), root_path, build_command: build_command.into(), output_directory: "dist".into(), server_id: "srv".into(), remote_path: "/var/www".into(), clean_remote_before_deploy: false, last_deployment: None }
}

#[test]
fn rejects_a_missing_output_directory_after_successful_build() {
    let project = project(std::env::temp_dir().to_string_lossy().into_owned(), "echo done");
    let error = validate_output_directory(&project).unwrap_err().user_message();
    assert!(error.contains("未找到输出目录 dist"), "unexpected message: {error}");
    assert!(error.contains("已检查"), "error should include the checked path: {error}");
}

#[test]
fn trims_whitespace_around_the_output_directory() {
    let root = std::env::temp_dir().join(format!("deploygo-trim-{}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));
    fs::create_dir_all(root.join("prod-dist")).unwrap();
    let mut trimmed = project(root.to_string_lossy().into_owned(), "echo done");
    trimmed.output_directory = " prod-dist \n".into();
    assert!(validate_output_directory(&trimmed).is_ok());
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn locates_the_output_directory_inside_a_shallow_subpackage() {
    let root = std::env::temp_dir().join(format!("deploygo-mono-{}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));
    fs::create_dir_all(root.join("packages/web/prod-dist")).unwrap();
    fs::write(root.join("package.json"), "{\"name\":\"mono\"}").unwrap();
    let mut monorepo = project(root.to_string_lossy().into_owned(), "echo done");
    monorepo.output_directory = "prod-dist".into();
    let found = validate_output_directory(&monorepo).unwrap();
    assert!(found.ends_with("packages/web/prod-dist"));
    fs::remove_dir_all(root).unwrap();
}

#[tokio::test]
async fn streams_build_output_lines_before_success() {
    let root = std::env::temp_dir().join(format!("deploygo-build-{}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));
    fs::create_dir_all(root.join("dist")).unwrap();
    let project = project(root.to_string_lossy().into_owned(), "printf 'first\n'; printf 'second\n'");
    let mut logs = Vec::new();
    let output = run_build(&project, CancellationToken::new(), |line| logs.push(line)).await.unwrap();
    assert!(output.ends_with("dist"));
    assert!(logs.iter().any(|line| line == "first"));
    assert!(logs.iter().any(|line| line == "second"));
    fs::remove_dir_all(root).unwrap();
}
