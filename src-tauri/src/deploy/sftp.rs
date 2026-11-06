use std::{collections::BTreeMap, fs, io::{self, Read}, path::{Path, PathBuf}};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use ssh2::Sftp;
use tokio_util::sync::CancellationToken;
use crate::{deploy::cancellation_point, error::AppError, models::ServerConfig, ssh};

pub const MANIFEST_NAME: &str = ".deploygo-manifest.json";

#[derive(Default, Serialize, Deserialize)]
pub struct UploadManifest { pub files: BTreeMap<String, String> }

pub fn file_hash(path: &Path) -> Result<String, AppError> {
    let mut file = fs::File::open(path).map_err(|_| AppError::Validation("无法读取待上传文件".into()))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 65_536];
    loop { let read = file.read(&mut buffer).map_err(|_| AppError::Validation("读取上传文件失败".into()))?; if read == 0 { break; } hasher.update(&buffer[..read]); }
    Ok(hasher.finalize().iter().map(|byte| format!("{byte:02x}")).collect())
}

pub fn manifest_bytes(files: &BTreeMap<String, String>) -> String { serde_json::to_string(&UploadManifest { files: files.clone() }).unwrap_or_else(|_| "{\"files\":{}}".into()) }

pub fn parse_manifest(bytes: &str) -> BTreeMap<String, String> { serde_json::from_str::<UploadManifest>(bytes).map(|manifest| manifest.files).unwrap_or_default() }

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

#[derive(Debug, Default)]
pub struct UploadOutcome { pub uploaded: usize, pub skipped: usize, pub total: usize, pub hashes: BTreeMap<String, String> }

pub fn read_remote_manifest(sftp: &Sftp, remote_root: &Path) -> BTreeMap<String, String> {
    let mut handle = match sftp.open(remote_root.join(MANIFEST_NAME).as_path()) { Ok(handle) => handle, Err(_) => return BTreeMap::new() };
    let mut contents = String::new();
    if handle.read_to_string(&mut contents).is_err() { return BTreeMap::new(); }
    parse_manifest(&contents)
}

pub fn write_remote_manifest(sftp: &Sftp, remote_root: &Path, files: &BTreeMap<String, String>) -> Result<(), AppError> {
    let path = remote_root.join(MANIFEST_NAME);
    if let Some(parent) = path.parent() { ensure_remote_directories(sftp, parent)?; }
    let mut handle = sftp.create(&path).map_err(|_| AppError::Validation("无法写入部署清单文件".into()))?;
    io::Write::write_all(&mut handle, manifest_bytes(files).as_bytes()).map_err(|_| AppError::Validation("无法写入部署清单文件".into()))
}

pub fn upload_output(server: &ServerConfig, local_root: &Path, remote_root: &Path, token: CancellationToken, on_progress: impl FnMut(&UploadFile, usize, usize, bool)) -> Result<UploadOutcome, AppError> { deploy_output(server, local_root, remote_root, false, false, token, on_progress) }

pub fn deploy_output(server: &ServerConfig, local_root: &Path, remote_root: &Path, clean_remote: bool, skip_unchanged: bool, token: CancellationToken, on_progress: impl FnMut(&UploadFile, usize, usize, bool)) -> Result<UploadOutcome, AppError> {
    cancellation_point(token.clone())?; let session = ssh::authenticated_session(server)?; cancellation_point(token.clone())?;
    let sftp = session.sftp().map_err(|_| AppError::Validation("无法建立 SFTP 通道".into()))?;
    if clean_remote { clear_remote_directory(&sftp, remote_root, token.clone())?; }
    let previous = if skip_unchanged { read_remote_manifest(&sftp, remote_root) } else { BTreeMap::new() };
    let outcome = upload_files(&sftp, local_root, remote_root, token, skip_unchanged, &previous, on_progress)?;
    write_remote_manifest(&sftp, remote_root, &outcome.hashes)?;
    Ok(outcome)
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

pub fn upload_files(sftp: &Sftp, local_root: &Path, remote_root: &Path, token: CancellationToken, skip_unchanged: bool, previous: &BTreeMap<String, String>, mut on_progress: impl FnMut(&UploadFile, usize, usize, bool)) -> Result<UploadOutcome, AppError> {
    let files = collect_upload_files(local_root)?; let total = files.len();
    let mut outcome = UploadOutcome { uploaded: 0, skipped: 0, total, hashes: BTreeMap::new() };
    let mut hashes = BTreeMap::new();
    for (index, file) in files.iter().enumerate() {
        cancellation_point(token.clone())?;
        let hash = file_hash(&file.absolute_path)?;
        let relative = file.relative_path.to_string_lossy().replace('\\', "/");
        hashes.insert(relative.clone(), hash.clone());
        let remote = remote_root.join(&file.relative_path);
        if skip_unchanged && previous.get(&relative) == Some(&hash) && sftp.stat(&remote).is_ok() {
            outcome.skipped += 1;
            on_progress(file, index + 1, total, true);
            continue;
        }
        if let Some(parent) = remote.parent() { ensure_remote_directories(sftp, parent)?; }
        let mut source = fs::File::open(&file.absolute_path).map_err(|_| AppError::Validation("无法读取待上传文件".into()))?;
        let mut destination = sftp.create(&remote).map_err(|_| AppError::Validation(format!("无法上传 {}", file.relative_path.display())))?;
        let mut buffer = [0u8; 65_536];
        loop { cancellation_point(token.clone())?; let read = source.read(&mut buffer).map_err(|_| AppError::Validation("读取上传文件失败".into()))?; if read == 0 { break; } io::Write::write_all(&mut destination, &buffer[..read]).map_err(|_| AppError::Validation("写入远程文件失败".into()))?; }
        outcome.uploaded += 1;
        on_progress(file, index + 1, total, false);
    }
    outcome.hashes = hashes;
    Ok(outcome)
}

fn ensure_remote_directories(sftp: &Sftp, path: &Path) -> Result<(), AppError> {
    let mut current = PathBuf::new();
    for part in path.components() { current.push(part); if let Err(error) = sftp.mkdir(&current, 0o755) { if sftp.stat(&current).is_err() { return Err(AppError::Validation(format!("无法创建远程目录 {}：{error}", current.display()))); } } }
    Ok(())
}