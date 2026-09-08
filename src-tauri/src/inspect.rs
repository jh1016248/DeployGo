use serde::Serialize;
use std::{collections::BTreeMap, fs, path::Path};
use crate::error::AppError;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInspection {
    pub scripts: BTreeMap<String, String>,
    pub output_candidates: Vec<String>,
    pub has_pnpm_workspace: bool,
}

pub fn inspect_project(root_path: String) -> Result<ProjectInspection, AppError> {
    let root = Path::new(&root_path);
    if !root.is_dir() { return Err(AppError::Validation("项目文件夹不存在或不可访问".into())); }
    let package_path = root.join("package.json");
    let package = fs::read_to_string(&package_path).map_err(|_| AppError::Validation("所选文件夹中未找到 package.json".into()))?;
    let value: serde_json::Value = serde_json::from_str(&package).map_err(|_| AppError::Validation("package.json 格式无效".into()))?;
    let scripts = value.get("scripts").and_then(serde_json::Value::as_object).map(|scripts| {
        scripts.iter().filter_map(|(name, command)| command.as_str().map(|command| (name.clone(), command.to_owned()))).collect()
    }).unwrap_or_default();
    let output_candidates = ["dist", "build", "out"].into_iter().filter(|name| root.join(name).is_dir()).map(str::to_string).collect();
    Ok(ProjectInspection { scripts, output_candidates, has_pnpm_workspace: root.join("pnpm-workspace.yaml").is_file() })
}
