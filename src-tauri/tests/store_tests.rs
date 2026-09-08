use deploygo_lib::models::{AuthType, ProjectConfig, ServerConfig};
use deploygo_lib::store::ConfigRepository;

fn server() -> ServerConfig {
    ServerConfig {
        id: "srv-1".into(), name: "Production".into(), host: "127.0.0.1".into(),
        port: 22, username: "root".into(), auth_type: AuthType::Password, password: Some("secret".into()),
        private_key_path: None, private_key_passphrase: None, deployment_path: "/var/www".into(),
        created_at: "2026-01-01T00:00:00Z".into(), updated_at: "2026-01-01T00:00:00Z".into(),
    }
}

#[test]
fn deleting_a_referenced_server_names_the_project() {
    let mut repository = ConfigRepository::default();
    repository.save_server(server());
    repository.save_project(ProjectConfig {
        id: "project-1".into(), name: "Web".into(), root_path: "/tmp/web".into(),
        build_command: "pnpm build".into(), output_directory: "dist".into(), server_id: "srv-1".into(),
        remote_path: "/var/www".into(), clean_remote_before_deploy: false, last_deployment: None,
    });

    assert_eq!(repository.delete_server("srv-1").unwrap_err().user_message(), "服务器正在被项目 Web 使用，无法删除");
}
