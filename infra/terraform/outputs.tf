output "api_url" {
  value = google_cloud_run_v2_service.api.uri
}

output "db_connection_name" {
  value = google_sql_database_instance.main.connection_name
}

output "upload_bucket" {
  value = google_storage_bucket.uploads.name
}
