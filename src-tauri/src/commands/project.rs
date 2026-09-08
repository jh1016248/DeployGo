use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use crate::inspect::{inspect_project as inspect, ProjectInspection};

#[tauri::command]
pub fn inspect_project(root_path: String) -> Result<ProjectInspection, String> { inspect(root_path).map_err(String::from) }

#[tauri::command]
pub async fn pick_project_directory(app: AppHandle) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || Ok(app.dialog().file().blocking_pick_folder().map(|path| path.to_string())))
        .await.map_err(|_| "文件夹选择器异常结束".to_string())?
}

#[tauri::command]
pub async fn pick_private_key(app: AppHandle) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || Ok(app.dialog().file().add_filter("SSH private key", &["pem", "key", "ppk"]).blocking_pick_file().map(|path| path.to_string())))
        .await.map_err(|_| "私钥选择器异常结束".to_string())?
}
