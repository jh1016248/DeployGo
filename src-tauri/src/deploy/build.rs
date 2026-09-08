use std::path::Path;
use tokio::process::Command;
use tokio_util::sync::CancellationToken;
use crate::{deploy::cancellation_point, error::AppError, models::ProjectConfig};

pub fn validate_output_directory(project: &ProjectConfig) -> Result<(), AppError> {
    let output = Path::new(&project.root_path).join(&project.output_directory);
    if output.is_dir() { Ok(()) } else { Err(AppError::Validation(format!("构建完成，但未找到输出目录 {}", project.output_directory))) }
}

pub async fn run_build(project: &ProjectConfig, token: CancellationToken) -> Result<Vec<String>, AppError> {
    cancellation_point(token.clone())?;
    let mut command = shell_command(&project.build_command);
    command.current_dir(&project.root_path);
    let child = command.output();
    tokio::select! {
        result = child => {
            let output = result.map_err(|_| AppError::Validation("无法启动打包命令，请检查项目路径和命令".into()))?;
            let mut lines = String::from_utf8_lossy(&output.stdout).lines().map(str::to_owned).collect::<Vec<_>>();
            lines.extend(String::from_utf8_lossy(&output.stderr).lines().map(str::to_owned));
            if !output.status.success() { return Err(AppError::Validation("打包命令执行失败，请查看部署日志".into())); }
            validate_output_directory(project)?;
            Ok(lines)
        }
        _ = token.cancelled() => Err(AppError::Cancelled),
    }
}

#[cfg(target_os = "windows")]
fn shell_command(command: &str) -> Command { let mut process = Command::new("cmd"); process.args(["/C", command]); process }
#[cfg(not(target_os = "windows"))]
fn shell_command(command: &str) -> Command { let mut process = Command::new("sh"); process.args(["-c", command]); process }
