use std::{fs, io::{self, Read}, path::{Path, PathBuf}};
use ssh2::Sftp;
use tokio_util::sync::CancellationToken;
use crate::{deploy::cancellation_point, error::AppError, models::ServerConfig, ssh};

#[derive(Debug, Clone)]
pub struct UploadFile { pub absolute_path: PathBuf, pub relative_path: PathBuf }

pub fn collect_upload_files(root: &Path) -> Result<Vec<UploadFile>, AppError> {
    if !root.is_dir() { return Err(AppError::Validation("输出目录不存在".into())); }
    let mut files = Vec::new(); collect_recursive(root, root, &mut files)?; Ok(files)
}

fn collect_recursive(root: &Path, current: &Path, files: &mut Vec<UploadFile>) -> Result<(), AppError> {
    for entry in fs::read_dir(current).map_err(|_| AppError::Validation("无法读取输出目录".into()))? {
        let path = entry.map_err(|_| AppError::Validation("无法读取输出文件".into()))?.path();
        if path.is_dir() { collect_recursive(root, &path, files)?; }
        else if path.is_file() { files.push(UploadFile { relative_path: path.strip_prefix(root).map_err(|_| AppError::Validation("输出路径无效".into()))?.to_path_buf(), absolute_path: path }); }
    }
    Ok(())
}

pub fn upload_output(server: &ServerConfig, local_root: &Path, remote_root: &Path, token: CancellationToken, on_progress: impl FnMut(&UploadFile, usize, usize)) -> Result<(), AppError> { deploy_output(server, local_root, remote_root, false, token, on_progress) }

pub fn deploy_output(server: &ServerConfig, local_root: &Path, remote_root: &Path, clean_remote: bool, token: CancellationToken, on_progress: impl FnMut(&UploadFile, usize, usize)) -> Result<(), AppError> {
    cancellation_point(token.clone())?; let session = ssh::authenticated_session(server)?; cancellation_point(token.clone())?;
    let sftp = session.sftp().map_err(|_| AppError::Validation("无法建立 SFTP 通道".into()))?;
    if clean_remote { clear_remote_directory(&sftp, remote_root, token.clone())?; }
    upload_files(&sftp, local_root, remote_root, token, on_progress)
}

pub fn clear_remote_directory(sftp: &Sftp, directory: &Path, token: CancellationToken) -> Result<(), AppError> {
    cancellation_point(token.clone())?;
    let entries = match sftp.readdir(directory) { Ok(entries) => entries, Err(_) => return Ok(()) };
    for (path, stat) in entries {
        cancellation_point(token.clone())?;
        let name = path.file_name().and_then(|item| item.to_str()).unwrap_or_default();
        if name == "." || name == ".." { continue; }
        if stat.is_dir() { clear_remote_directory(sftp, &path, token.clone())?; sftp.rmdir(&path).map_err(|_| AppError::Validation(format!("无法删除远程目录 {}", path.display())))?; }
        else { sftp.unlink(&path).map_err(|_| AppError::Validation(format!("无法删除远程文件 {}", path.display())))?; }
    }
    Ok(())
}

pub fn upload_files(sftp: &Sftp, local_root: &Path, remote_root: &Path, token: CancellationToken, mut on_progress: impl FnMut(&UploadFile, usize, usize)) -> Result<(), AppError> {
    let files = collect_upload_files(local_root)?; let total = files.len();
    for (index, file) in files.iter().enumerate() {
        cancellation_point(token.clone())?;
        let remote = remote_root.join(&file.relative_path);
        if let Some(parent) = remote.parent() { ensure_remote_directories(sftp, parent)?; }
        let mut source = fs::File::open(&file.absolute_path).map_err(|_| AppError::Validation("无法读取待上传文件".into()))?;
        let mut destination = sftp.create(&remote).map_err(|_| AppError::Validation(format!("无法上传 {}", file.relative_path.display())))?;
        let mut buffer = [0u8; 65_536];
        loop { cancellation_point(token.clone())?; let read = source.read(&mut buffer).map_err(|_| AppError::Validation("读取上传文件失败".into()))?; if read == 0 { break; } io::Write::write_all(&mut destination, &buffer[..read]).map_err(|_| AppError::Validation("写入远程文件失败".into()))?; }
        on_progress(file, index + 1, total);
    }
    Ok(())
}

fn ensure_remote_directories(sftp: &Sftp, path: &Path) -> Result<(), AppError> {
    let mut current = PathBuf::new();
    for part in path.components() { current.push(part); if let Err(error) = sftp.mkdir(&current, 0o755) { if sftp.stat(&current).is_err() { return Err(AppError::Validation(format!("无法创建远程目录 {}：{error}", current.display()))); } } }
    Ok(())
}
