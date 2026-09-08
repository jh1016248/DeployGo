use deploygo_lib::inspect::inspect_project;

#[test]
fn lists_scripts_output_candidate_and_workspace_marker() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/vite-project");
    let inspected = inspect_project(root.to_string_lossy().into_owned()).unwrap();

    assert_eq!(inspected.scripts.get("build"), Some(&"vite build".to_string()));
    assert!(inspected.output_candidates.contains(&"dist".to_string()));
    assert!(inspected.has_pnpm_workspace);
}
