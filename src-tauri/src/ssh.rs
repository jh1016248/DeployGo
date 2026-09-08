use std::{net::{SocketAddr, TcpStream}, path::Path, time::Duration};
use ssh2::Session;
use crate::{error::AppError, models::{AuthType, ServerConfig}};

pub const SSH_TIMEOUT_SECONDS: u64 = 10;

pub fn authenticated_session(server: &ServerConfig) -> Result<Session, AppError> {
    let address: SocketAddr = format!("{}:{}", server.host, server.port).parse().map_err(|_| AppError::Validation("IP 地址或端口格式无效".into()))?;
    let timeout = Duration::from_secs(SSH_TIMEOUT_SECONDS);
    let stream = TcpStream::connect_timeout(&address, timeout).map_err(|error| connection_error(&error.to_string(), server))?;
    stream.set_read_timeout(Some(timeout)).map_err(|error| connection_error(&error.to_string(), server))?;
    stream.set_write_timeout(Some(timeout)).map_err(|error| connection_error(&error.to_string(), server))?;
    let mut session = Session::new().map_err(|_| AppError::Validation("无法创建 SSH 会话".into()))?;
    session.set_tcp_stream(stream);
    session.handshake().map_err(|error| connection_error(&error.to_string(), server))?;
    match server.auth_type {
        AuthType::Password => session.userauth_password(&server.username, server.password.as_deref().unwrap_or_default()),
        AuthType::PrivateKey => session.userauth_pubkey_file(&server.username, None, Path::new(server.private_key_path.as_deref().unwrap_or_default()), server.private_key_passphrase.as_deref()),
    }.map_err(|error| connection_error(&error.to_string(), server))?;
    if session.authenticated() { Ok(session) } else { Err(AppError::Validation("认证失败：请检查用户名、密码或私钥".into())) }
}

pub fn test_connection(server: &ServerConfig) -> Result<(), AppError> { authenticated_session(server).map(|_| ()) }

fn connection_error(raw: &str, server: &ServerConfig) -> AppError { AppError::Validation(friendly_connection_error(raw, &[server.password.as_deref().unwrap_or_default(), server.private_key_passphrase.as_deref().unwrap_or_default()])) }

pub fn normalize_remote_path(base: &str, path: &str) -> String {
    let joined = format!("{}/{}", base.trim_end_matches('/'), path.trim_matches('/'));
    let normalized = joined.split('/').filter(|segment| !segment.is_empty()).collect::<Vec<_>>().join("/");
    format!("/{normalized}")
}

pub fn friendly_connection_error(raw: &str, secrets: &[&str]) -> String {
    let redacted = secrets.iter().filter(|secret| !secret.is_empty()).fold(raw.to_owned(), |message, secret| message.replace(secret, "***"));
    if redacted.to_lowercase().contains("timed out") { "连接超时：请检查 IP、端口、防火墙或 VPN".into() }
    else if redacted.to_lowercase().contains("auth") { "认证失败：请检查用户名、密码或私钥".into() }
    else { format!("SSH 连接失败：{redacted}") }
}
