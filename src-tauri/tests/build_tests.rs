use deploygo_lib::{deploy::build::validate_output_directory, models::ProjectConfig};

#[test]
fn rejects_a_missing_output_directory_after_successful_build() {
    let project = ProjectConfig {
        id: "project-1".into(), name: "Web".into(), root_path: std::env::temp_dir().to_string_lossy().into_owned(),
        build_command: "echo done".into(), output_directory: "missing-dist".into(), server_id: "srv".into(),
        remote_path: "/var/www".into(), clean_remote_before_deploy: false, last_deployment: None,
    };
    assert_eq!(validate_output_directory(&project).unwrap_err().user_message(), "构建完成，但未找到输出目录 missing-dist");
}
