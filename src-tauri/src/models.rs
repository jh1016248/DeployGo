use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum AuthType { Password, PrivateKey }

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerConfig {
    pub id: String, pub name: String, pub host: String, pub port: u16, pub username: String,
    pub auth_type: AuthType, pub password: Option<String>, pub private_key_path: Option<String>,
    pub private_key_passphrase: Option<String>, pub deployment_path: String, pub created_at: String, pub updated_at: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeploymentSummary { pub id: String, pub started_at: String, pub finished_at: Option<String>, pub status: String, pub files_uploaded: u64, pub error_message: Option<String> }

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectConfig {
    pub id: String, pub name: String, pub root_path: String, pub build_command: String, pub output_directory: String,
    pub server_id: String, pub remote_path: String, pub clean_remote_before_deploy: bool, pub last_deployment: Option<DeploymentSummary>,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig { pub servers: Vec<ServerConfig>, pub projects: Vec<ProjectConfig> }
