terraform {
  required_version = ">= 1.9"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 6.0, < 8.0"
    }
  }
  # Bucket comes from -backend-config in the deploy workflow (one state bucket per environment).
  backend "gcs" {
    prefix = "mini-philia"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
