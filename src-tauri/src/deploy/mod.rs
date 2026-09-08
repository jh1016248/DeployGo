use std::{collections::HashMap, sync::atomic::{AtomicU64, Ordering}};
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;
use crate::error::AppError;
pub mod build;
pub mod sftp;

static NEXT_DEPLOYMENT: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum DeploymentPhase { Idle, Validating, Building, ScanningOutput, CleaningRemote, Uploading, Completed, Failed, Cancelled }

#[derive(Clone, Debug)]
pub struct DeploymentProgress { pub deployment_id: String, pub project_id: String, pub phase: DeploymentPhase, pub completed_files: u64, pub total_files: u64 }

#[derive(Default)]
pub struct DeploymentRegistry { deployments: Mutex<HashMap<String, ActiveDeployment>> }

struct ActiveDeployment { project_id: String, token: CancellationToken }

impl DeploymentRegistry {
    pub async fn start(&self, project_id: String) -> Result<String, AppError> {
        let mut deployments = self.deployments.lock().await;
        if deployments.values().any(|deployment| deployment.project_id == project_id) { return Err(AppError::Validation("该项目已有部署任务正在运行".into())); }
        let id = format!("deploy-{}", NEXT_DEPLOYMENT.fetch_add(1, Ordering::Relaxed));
        deployments.insert(id.clone(), ActiveDeployment { project_id, token: CancellationToken::new() });
        Ok(id)
    }
    pub async fn token(&self, id: &str) -> Result<CancellationToken, AppError> {
        self.deployments.lock().await.get(id).map(|deployment| deployment.token.clone()).ok_or_else(|| AppError::NotFound("未找到部署任务".into()))
    }
    pub async fn cancel(&self, id: &str) -> Result<(), AppError> { self.token(id).await?.cancel(); Ok(()) }
    pub async fn finish(&self, id: &str) { self.deployments.lock().await.remove(id); }
}

pub fn cancellation_point(token: CancellationToken) -> Result<(), AppError> { if token.is_cancelled() { Err(AppError::Cancelled) } else { Ok(()) } }
