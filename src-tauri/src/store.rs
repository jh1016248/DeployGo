use crate::{error::AppError, models::{AppConfig, ProjectConfig, ServerConfig}};
use serde_json::Value;
use tauri::{AppHandle, Runtime};
use tauri_plugin_store::StoreExt;

const CONFIG_STORE: &str = "deploygo-config.json";
const CONFIG_KEY: &str = "configuration";

#[derive(Default)]
pub struct ConfigRepository { config: AppConfig }

impl ConfigRepository {
    pub fn from_config(config: AppConfig) -> Self { Self { config } }
    pub fn snapshot(&self) -> AppConfig { self.config.clone() }
    pub fn save_server(&mut self, server: ServerConfig) {
        if let Some(index) = self.config.servers.iter().position(|item| item.id == server.id) { self.config.servers[index] = server; } else { self.config.servers.push(server); }
    }
    pub fn save_project(&mut self, project: ProjectConfig) {
        if let Some(index) = self.config.projects.iter().position(|item| item.id == project.id) { self.config.projects[index] = project; } else { self.config.projects.push(project); }
    }
    pub fn delete_server(&mut self, id: &str) -> Result<(), AppError> {
        if let Some(project) = self.config.projects.iter().find(|project| project.server_id == id) { return Err(AppError::Validation(format!("服务器正在被项目 {} 使用，无法删除", project.name))); }
        let previous = self.config.servers.len(); self.config.servers.retain(|server| server.id != id);
        if previous == self.config.servers.len() { return Err(AppError::NotFound("未找到服务器".into())); }
        Ok(())
    }
    pub fn delete_project(&mut self, id: &str) -> Result<(), AppError> {
        let previous = self.config.projects.len(); self.config.projects.retain(|project| project.id != id);
        if previous == self.config.projects.len() { return Err(AppError::NotFound("未找到项目".into())); }
        Ok(())
    }
}

pub fn load_repository<R: Runtime>(app: &AppHandle<R>) -> Result<ConfigRepository, AppError> {
    let store = app.store(CONFIG_STORE).map_err(|_| AppError::Storage)?;
    let config = store.get(CONFIG_KEY).and_then(|value| serde_json::from_value::<AppConfig>(value).ok()).unwrap_or_default();
    Ok(ConfigRepository::from_config(config))
}

pub fn persist_repository<R: Runtime>(app: &AppHandle<R>, repository: &ConfigRepository) -> Result<(), AppError> {
    let value: Value = serde_json::to_value(repository.snapshot()).map_err(|_| AppError::Storage)?;
    let store = app.store(CONFIG_STORE).map_err(|_| AppError::Storage)?;
    store.set(CONFIG_KEY, value);
    store.save().map_err(|_| AppError::Storage)
}
