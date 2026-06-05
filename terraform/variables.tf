variable "region" {
  description = "AWS region"
  default     = "us-east-1"
}

variable "project_name" {
  description = "Prefix applied to all resource names"
  default     = "hero-cli"
}

variable "environment" {
  description = "Deployment environment"
  default     = "production"
}

variable "dashboard_port" {
  description = "Port exposed by the Express dashboard"
  default     = 3000
}

variable "neo4j_http_port" {
  default = 7474
}

variable "neo4j_bolt_port" {
  default = 7687
}

variable "neo4j_password" {
  description = "Neo4j admin password"
  sensitive   = true
}

variable "superhero_token" {
  description = "SuperHero API access token"
  sensitive   = true
}

variable "dashboard_image" {
  description = "Full ECR image URI for the dashboard container (e.g. 123456789.dkr.ecr.us-east-1.amazonaws.com/hero-cli-dashboard:latest)"
}
