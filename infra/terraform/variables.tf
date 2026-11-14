variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "environment" {
  type = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production"
  }
}

variable "image" {
  description = "Container image by digest, built once and promoted"
  type        = string
}

variable "app_version" {
  type = string
}

variable "runtime_sa_email" {
  description = "api-runtime service account, created by infra/bootstrap"
  type        = string
}

variable "deletion_protection" {
  type = bool
}

variable "db_tier" {
  description = "Keep small. See docs/cost-guardrails.md"
  type        = string
  default     = "db-f1-micro"
}

variable "point_in_time_recovery" {
  type    = bool
  default = false
}

variable "api_max_instances" {
  type    = number
  default = 2
}

variable "vertex_location" {
  description = "Vertex AI location for Claude models (verify in Model Garden)"
  type        = string
  default     = "global"
}
