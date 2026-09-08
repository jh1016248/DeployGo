use std::sync::Mutex;
use tauri::{AppHandle, State};
use crate::{models::{AppConfig, ProjectConfig, ServerConfig}, store::{persist_repository, ConfigRepository}};

#[tauri::command]
pub fn get_configs(repository: State<'_, Mutex<ConfigRepository>>) -> Result<AppConfig, String> {
    repository.lock().map_err(|_| "配置正在被使用，请重试".to_string()).map(|store| store.snapshot())
}

#[tauri::command]
pub fn save_server(app: AppHandle, repository: State<'_, Mutex<ConfigRepository>>, server: ServerConfig) -> Result<(), String> {
    let mut store = repository.lock().map_err(|_| "配置正在被使用，请重试".to_string())?;
    store.save_server(server); persist_repository(&app, &store).map_err(String::from)
}

#[tauri::command]
pub fn delete_server(app: AppHandle, repository: State<'_, Mutex<ConfigRepository>>, id: String) -> Result<(), String> {
    let mut store = repository.lock().map_err(|_| "配置正在被使用，请重试".to_string())?;
    store.delete_server(&id).map_err(String::from)?; persist_repository(&app, &store).map_err(String::from)
}

#[tauri::command]
pub fn save_project(app: AppHandle, repository: State<'_, Mutex<ConfigRepository>>, project: ProjectConfig) -> Result<(), String> {
    let mut store = repository.lock().map_err(|_| "配置正在被使用，请重试".to_string())?;
    store.save_project(project); persist_repository(&app, &store).map_err(String::from)
}

#[tauri::command]
pub fn delete_project(app: AppHandle, repository: State<'_, Mutex<ConfigRepository>>, id: String) -> Result<(), String> {
    let mut store = repository.lock().map_err(|_| "配置正在被使用，请重试".to_string())?;
    store.delete_project(&id).map_err(String::from)?; persist_repository(&app, &store).map_err(String::from)
}
