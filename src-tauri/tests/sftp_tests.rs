use deploygo_lib::deploy::sftp::collect_upload_files;

#[test]
fn collects_relative_files_from_output_directory() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/vite-project");
    std::fs::write(root.join("dist/index.html"), "ok").unwrap();
    let files = collect_upload_files(&root.join("dist")).unwrap();
    assert!(files.iter().any(|file| file.relative_path == std::path::PathBuf::from("index.html")));
}
