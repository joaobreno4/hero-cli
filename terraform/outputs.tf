output "vpc_id" {
  description = "ID of the provisioned VPC"
  value       = aws_vpc.main.id
}

output "dashboard_security_group_id" {
  value = aws_security_group.dashboard.id
}

output "neo4j_security_group_id" {
  value = aws_security_group.neo4j.id
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "dashboard_service_name" {
  value = aws_ecs_service.dashboard.name
}

output "ecr_repository_url" {
  description = "Push dashboard images here before deploying"
  value       = aws_ecr_repository.dashboard.repository_url
}

output "alb_dns_name" {
  description = "Public URL of the dashboard"
  value       = "http://${aws_lb.dashboard.dns_name}"
}
