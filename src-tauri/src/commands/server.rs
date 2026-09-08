use crate::{models::ServerConfig, ssh};

#[tauri::command]
pub async fn test_ssh_connection(server: ServerConfig) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || ssh::test_connection(&server).map_err(String::from))
        .await
        .map_err(|_| "SSH 测试任务异常结束".to_string())?
}
