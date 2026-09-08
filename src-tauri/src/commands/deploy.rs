use std::{path::Path, sync::Mutex, time::{SystemTime, UNIX_EPOCH}};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_notification::NotificationExt;
use crate::{deploy::{build, sftp, DeploymentRegistry}, models::{DeploymentSummary, ProjectConfig, ServerConfig}, store::{persist_repository, ConfigRepository}};

#[tauri::command]
pub async fn start_deployment(app: AppHandle, repository: State<'_, Mutex<ConfigRepository>>, registry: State<'_, DeploymentRegistry>, project_id: String) -> Result<String, String> {
    let (project, server) = deployment_config(&repository, &project_id)?;
    let deployment_id = registry.start(project.id.clone()).await.map_err(String::from)?;
    let token = registry.token(&deployment_id).await.map_err(String::from)?;
    emit(&app, "deployment://progress", &deployment_id, &project.id, serde_json::json!({"phase": "validating", "percent": 0}));
    let app_handle = app.clone(); let task_id = deployment_id.clone();
    tauri::async_runtime::spawn(async move {
        let started_at = timestamp();
        let result = run_deployment(&app_handle, &task_id, &project, &server, token).await;
        let (status, uploaded, error_message) = match &result { Ok(files) => ("success", *files as u64, None), Err(error) if error == "部署已取消" => ("cancelled", 0, Some(error.clone())), Err(error) => ("failed", 0, Some(error.clone())) };
        let repository = app_handle.state::<Mutex<ConfigRepository>>();
        if let Err(error) = update_summary(&app_handle, &repository, &project.id, DeploymentSummary { id: task_id.clone(), started_at, finished_at: Some(timestamp()), status: status.into(), files_uploaded: uploaded, error_message: error_message.clone() }) { emit(&app_handle, "deployment://log", &task_id, &project.id, serde_json::json!({"level": "error", "message": error})); }
        emit(&app_handle, "deployment://complete", &task_id, &project.id, serde_json::json!({"status": status, "filesUploaded": uploaded, "errorMessage": error_message}));
        if status == "success" { let _ = app_handle.notification().builder().title(format!("{} 部署成功", project.name)).body(format!("已上传 {} 个文件", uploaded)).show(); }
        app_handle.state::<DeploymentRegistry>().finish(&task_id).await;
    });
    Ok(deployment_id)
}

#[tauri::command]
pub async fn cancel_deployment(registry: State<'_, DeploymentRegistry>, deployment_id: String) -> Result<(), String> { registry.cancel(&deployment_id).await.map_err(String::from) }

fn deployment_config(repository: &State<'_, Mutex<ConfigRepository>>, id: &str) -> Result<(ProjectConfig, ServerConfig), String> {
    let config = repository.lock().map_err(|_| "配置正在被使用，请重试".to_string())?.snapshot();
    let project = config.projects.into_iter().find(|project| project.id == id).ok_or_else(|| "未找到项目".to_string())?;
    let server = config.servers.into_iter().find(|server| server.id == project.server_id).ok_or_else(|| "项目关联的服务器不存在".to_string())?;
    Ok((project, server))
}

async fn run_deployment(app: &AppHandle, deployment_id: &str, project: &ProjectConfig, server: &ServerConfig, token: tokio_util::sync::CancellationToken) -> Result<usize, String> {
    emit(app, "deployment://progress", deployment_id, &project.id, serde_json::json!({"phase": "building", "percent": 5}));
    build::run_build(project, token.clone(), |line| emit(app, "deployment://log", deployment_id, &project.id, serde_json::json!({"level": "info", "message": line}))).await.map_err(String::from)?;
    emit(app, "deployment://progress", deployment_id, &project.id, serde_json::json!({"phase": "uploading", "percent": 30}));
    let app_handle = app.clone(); let id = deployment_id.to_owned(); let project_id = project.id.clone(); let server = server.clone(); let output = Path::new(&project.root_path).join(&project.output_directory); let remote = project.remote_path.clone(); let clean_remote = project.clean_remote_before_deploy;
    tauri::async_runtime::spawn_blocking(move || {
        let mut total = 0; sftp::deploy_output(&server, &output, Path::new(&remote), clean_remote, token, |file, current, count| { total = count; let percent = 30 + ((current * 70) / count.max(1)); emit(&app_handle, "deployment://progress", &id, &project_id, serde_json::json!({"phase": "uploading", "file": file.relative_path, "completedFiles": current, "totalFiles": count, "percent": percent})); }).map(|_| total)
    }).await.map_err(|_| "上传任务异常结束".to_string())?.map_err(String::from)
}

fn update_summary(app: &AppHandle, repository: &State<'_, Mutex<ConfigRepository>>, project_id: &str, summary: DeploymentSummary) -> Result<(), String> {
    let mut store = repository.lock().map_err(|_| "配置正在被使用，请重试".to_string())?;
    let mut project = store.snapshot().projects.into_iter().find(|item| item.id == project_id).ok_or_else(|| "未找到项目".to_string())?;
    project.last_deployment = Some(summary); store.save_project(project); persist_repository(app, &store).map_err(String::from)
}

fn emit(app: &AppHandle, event: &str, deployment_id: &str, project_id: &str, payload: serde_json::Value) { let _ = app.emit(event, serde_json::json!({"deploymentId": deployment_id, "projectId": project_id, "timestamp": timestamp(), "data": payload})); }
fn timestamp() -> String { SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs().to_string() }
