locals {
  # Cloud SQL IAM user name for a service account drops the .gserviceaccount.com suffix.
  db_iam_user = trimsuffix(var.runtime_sa_email, ".gserviceaccount.com")
}

# ---------------------------------------------------------------- database
resource "google_sql_database_instance" "main" {
  name                = "mini-philia-${var.environment}"
  database_version    = "POSTGRES_16"
  region              = var.region
  deletion_protection = var.deletion_protection

  settings {
    # Explicit edition and tier. The default edition for PostgreSQL 16 can be Enterprise Plus, which costs far more.
    edition                     = "ENTERPRISE"
    tier                        = var.db_tier
    availability_type           = "ZONAL"
    disk_type                   = "PD_SSD"
    disk_size                   = 10
    disk_autoresize             = true
    disk_autoresize_limit       = 20
    deletion_protection_enabled = var.deletion_protection

    ip_configuration {
      # Public IP with no authorized networks: reachable only through the Cloud SQL connector, with IAM auth and TLS.
      ipv4_enabled = true
      ssl_mode     = "ENCRYPTED_ONLY"
    }

    database_flags {
      name  = "cloudsql.iam_authentication"
      value = "on"
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = var.point_in_time_recovery
      backup_retention_settings {
        retained_backups = 7
      }
    }

    insights_config {
      query_insights_enabled = false
    }

    user_labels = {
      app = "mini-philia"
      env = var.environment
    }
  }
}

resource "google_sql_database" "app" {
  name     = "mini_philia"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "api" {
  name     = local.db_iam_user
  instance = google_sql_database_instance.main.name
  type     = "CLOUD_IAM_SERVICE_ACCOUNT"
}

# ---------------------------------------------------------------- bronze file store
resource "google_storage_bucket" "uploads" {
  name                        = "${var.project_id}-uploads"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      days_since_noncurrent_time = 30
    }
    action {
      type = "Delete"
    }
  }

  labels = {
    app = "mini-philia"
    env = var.environment
  }
}

# Bronze is write once: the API can create and read objects, never overwrite or delete them.
resource "google_storage_bucket_iam_member" "api_create" {
  bucket = google_storage_bucket.uploads.name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${var.runtime_sa_email}"
}

resource "google_storage_bucket_iam_member" "api_read" {
  bucket = google_storage_bucket.uploads.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${var.runtime_sa_email}"
}

# ---------------------------------------------------------------- api
resource "google_cloud_run_v2_service" "api" {
  name                = "api"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account                  = var.runtime_sa_email
    max_instance_request_concurrency = 80

    scaling {
      min_instance_count = 0
      max_instance_count = var.api_max_instances
    }

    containers {
      image = var.image
      ports {
        container_port = 8080
      }
      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle          = true
        startup_cpu_boost = false
      }
      env {
        name  = "APP_ENV"
        value = var.environment
      }
      env {
        name  = "APP_VERSION"
        value = var.app_version
      }
      env {
        name  = "GCP_PROJECT"
        value = var.project_id
      }
      env {
        name  = "DB_INSTANCE"
        value = google_sql_database_instance.main.connection_name
      }
      env {
        name  = "DB_NAME"
        value = google_sql_database.app.name
      }
      env {
        name  = "DB_USER"
        value = google_sql_user.api.name
      }
      env {
        name  = "UPLOAD_BUCKET"
        value = google_storage_bucket.uploads.name
      }
      env {
        name  = "VERTEX_LOCATION"
        value = var.vertex_location
      }
      env {
        name  = "AI_PROVIDER"
        value = var.ai_provider
      }
      env {
        name  = "AI_MODEL"
        value = var.ai_model
      }
      startup_probe {
        http_get {
          path = "/health"
        }
      }
    }
  }

  labels = {
    app = "mini-philia"
    env = var.environment
  }
}

# Public endpoint. Application level auth arrives with the auth work item.
resource "google_cloud_run_v2_service_iam_member" "api_public" {
  name     = google_cloud_run_v2_service.api.name
  location = google_cloud_run_v2_service.api.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
