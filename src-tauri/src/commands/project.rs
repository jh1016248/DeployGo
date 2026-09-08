use crate::inspect::{inspect_project as inspect, ProjectInspection};

#[tauri::command]
pub fn inspect_project(root_path: String) -> Result<ProjectInspection, String> {
    inspect(root_path).map_err(String::from)
}
