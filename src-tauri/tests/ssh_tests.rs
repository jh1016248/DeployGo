use deploygo_lib::ssh::{friendly_connection_error, normalize_remote_path};

#[test]
fn normalizes_remote_path_without_duplicate_separators() {
    assert_eq!(normalize_remote_path("/var/www/", "/assets/"), "/var/www/assets");
}

#[test]
fn redacts_password_from_connection_errors() {
    assert!(!friendly_connection_error("auth failed: super-secret", &["super-secret"]).contains("super-secret"));
}
