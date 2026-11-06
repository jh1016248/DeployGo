use std::collections::BTreeMap;
use deploygo_lib::deploy::sftp::{collect_upload_files, file_hash, manifest_bytes, parse_manifest};

#[test]
fn collects_relative_files_from_output_directory() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/vite-project");
    std::fs::write(root.join("dist/index.html"), "ok").unwrap();
    let files = collect_upload_files(&root.join("dist")).unwrap();
    assert!(files.iter().any(|file| file.relative_path == std::path::PathBuf::from("index.html")));
}

#[test]
fn hashes_identical_content_identically_and_differs_on_change() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/vite-project");
    let target = root.join("dist/index.html");
    std::fs::write(&target, "same-content").unwrap();
    let first = file_hash(&target).unwrap();
    let second = file_hash(&target).unwrap();
    assert_eq!(first, second);
    assert_eq!(first.len(), 64);
    std::fs::write(&target, "changed-content").unwrap();
    assert_ne!(file_hash(&target).unwrap(), first);
    std::fs::write(&target, "ok").unwrap();
}

#[test]
fn manifest_serialization_round_trips_through_parse() {
    let mut files = BTreeMap::new();
    files.insert("assets/index-ABC.js".to_string(), "deadbeef".to_string());
    files.insert("index.html".to_string(), "cafebabe".to_string());
    let parsed = parse_manifest(&manifest_bytes(&files));
    assert_eq!(parsed, files);
    assert_eq!(parse_manifest("not-json"), BTreeMap::new());
}
