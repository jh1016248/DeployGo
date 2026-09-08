use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("{0}")]
    Validation(String),
    #[error("{0}")]
    NotFound(String),
    #[error("配置保存失败")]
    Storage,
    #[error("部署已取消")]
    Cancelled,
}

impl AppError {
    pub fn user_message(&self) -> String { self.to_string() }
}

impl From<AppError> for String {
    fn from(error: AppError) -> Self { error.user_message() }
}
