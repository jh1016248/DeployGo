use std::{path::Path, process::Stdio, time::Duration};
use tokio::{io::{AsyncBufReadExt, AsyncRead, BufReader}, process::Command, sync::mpsc, time::sleep};
use tokio_util::sync::CancellationToken;
use crate::{deploy::cancellation_point, error::AppError, models::ProjectConfig};

pub fn validate_output_directory(project: &ProjectConfig) -> Result<(), AppError> {
    let output = Path::new(&project.root_path).join(&project.output_directory);
    if output.is_dir() { Ok(()) } else { Err(AppError::Validation(format!("构建完成，但未找到输出目录 {}", project.output_directory))) }
}

pub async fn run_build<F>(project: &ProjectConfig, token: CancellationToken, mut on_log: F) -> Result<(), AppError>
where F: FnMut(String) {
    cancellation_point(token.clone())?;
    let mut command = shell_command(&project.build_command);
    command.current_dir(&project.root_path).stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = command.spawn().map_err(|_| AppError::Validation("无法启动打包命令，请检查项目路径和命令".into()))?;
    let stdout = child.stdout.take().ok_or_else(|| AppError::Validation("无法读取打包标准输出".into()))?;
    let stderr = child.stderr.take().ok_or_else(|| AppError::Validation("无法读取打包错误输出".into()))?;
    let (sender, mut receiver) = mpsc::unbounded_channel();
    let stdout_task = tokio::spawn(read_lines(stdout, sender.clone()));
    let stderr_task = tokio::spawn(read_lines(stderr, sender));

    let status = loop {
        if let Some(status) = child.try_wait().map_err(|_| AppError::Validation("无法等待打包命令结束".into()))? { break status; }
        tokio::select! {
            _ = token.cancelled() => {
                let _ = child.kill().await;
                let _ = stdout_task.await;
                let _ = stderr_task.await;
                return Err(AppError::Cancelled);
            }
            Some(line) = receiver.recv() => on_log(line),
            _ = sleep(Duration::from_millis(20)) => {}
        }
    };
    let _ = stdout_task.await;
    let _ = stderr_task.await;
    while let Ok(line) = receiver.try_recv() { on_log(line); }
    cancellation_point(token)?;
    if !status.success() { return Err(AppError::Validation("打包命令执行失败，请查看部署日志".into())); }
    validate_output_directory(project)
}

async fn read_lines<R: AsyncRead + Unpin>(reader: R, sender: mpsc::UnboundedSender<String>) {
    let mut lines = BufReader::new(reader).lines();
    while let Ok(Some(line)) = lines.next_line().await { let _ = sender.send(line); }
}

#[cfg(target_os = "windows")]
fn shell_spec(command: &str) -> (&'static str, [&str; 2]) { ("cmd", ["/C", command]) }
#[cfg(target_os = "macos")]
fn shell_spec(command: &str) -> (&'static str, [&str; 2]) { ("/bin/zsh", ["-lic", command]) }
#[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
fn shell_spec(command: &str) -> (&'static str, [&str; 2]) { ("sh", ["-c", command]) }
fn shell_command(command: &str) -> Command { let (program, args) = shell_spec(command); let mut process = Command::new(program); process.args(args); process }

#[cfg(test)]
mod tests {
    use super::shell_spec;
    #[cfg(target_os = "macos")]
    #[test]
    fn macos_uses_a_login_interactive_zsh_for_node_toolchains() {
        assert_eq!(shell_spec("pnpm build"), ("/bin/zsh", ["-lic", "pnpm build"]));
    }
}
