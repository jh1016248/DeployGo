pub mod commands;
pub mod error;
pub mod deploy;
pub mod inspect;
pub mod models;
pub mod store;
pub mod ssh;

use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let repository = store::load_repository(app.handle())?;
            app.manage(Mutex::new(repository));
            app.manage(deploy::DeploymentRegistry::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::config::get_configs, commands::config::save_server, commands::config::delete_server,
            commands::config::save_project, commands::config::delete_project,
            commands::project::inspect_project, commands::server::test_ssh_connection,
            commands::deploy::start_deployment, commands::deploy::cancel_deployment
        ])
        .run(tauri::generate_context!())
        .expect("error while running DeployGo application");
}
