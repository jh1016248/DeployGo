use deploygo_lib::deploy::{cancellation_point, DeploymentRegistry};

#[tokio::test]
async fn cancel_marks_active_deployment_and_cancellation_point_stops_work() {
    let registry = DeploymentRegistry::default();
    let id = registry.start("project-1".into()).await.unwrap();
    registry.cancel(&id).await.unwrap();

    assert!(cancellation_point(registry.token(&id).await.unwrap()).is_err());
}
