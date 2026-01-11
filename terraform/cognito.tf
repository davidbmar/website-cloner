# AWS Cognito User Pool and App Client Configuration
# Creates authentication infrastructure for the website cloner and SSH terminal

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  description = "AWS region for Cognito resources"
  type        = string
  default     = "us-east-1"
}

variable "domain_prefix" {
  description = "Cognito domain prefix (must be globally unique)"
  type        = string
  default     = "website-cloner"
}

variable "callback_url" {
  description = "OAuth callback URL"
  type        = string
  default     = "https://52.43.35.1/oauth2/callback"
}

variable "logout_url" {
  description = "OAuth logout URL"
  type        = string
  default     = "https://52.43.35.1/"
}

# Cognito User Pool
resource "aws_cognito_user_pool" "main" {
  name = "website-cloner-users"

  # Email as username
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Password policy
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  # MFA configuration (optional, set to OPTIONAL or OFF)
  mfa_configuration = "OFF"

  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Email configuration
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # User attributes
  schema {
    attribute_data_type      = "String"
    name                     = "email"
    required                 = true
    mutable                  = false
    developer_only_attribute = false

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  tags = {
    Name        = "website-cloner-user-pool"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}

# Cognito User Pool Domain
resource "aws_cognito_user_pool_domain" "main" {
  domain       = "${var.domain_prefix}-${random_string.domain_suffix.result}"
  user_pool_id = aws_cognito_user_pool.main.id
}

# Random suffix for domain uniqueness
resource "random_string" "domain_suffix" {
  length  = 10
  special = false
  upper   = false
}

# Cognito User Pool Client (App Client)
resource "aws_cognito_user_pool_client" "main" {
  name         = "website-cloner-app"
  user_pool_id = aws_cognito_user_pool.main.id

  # Generate client secret
  generate_secret = true

  # OAuth flows
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]

  # Callback and logout URLs
  callback_urls = [var.callback_url]
  logout_urls   = [var.logout_url]

  # Supported identity providers
  supported_identity_providers = ["COGNITO"]

  # Token validity
  access_token_validity  = 60  # minutes
  id_token_validity      = 60  # minutes
  refresh_token_validity = 30  # days

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  # Prevent destruction of the resource
  lifecycle {
    create_before_destroy = true
  }
}

# Test user (optional - for development only)
resource "aws_cognito_user" "test_user" {
  user_pool_id = aws_cognito_user_pool.main.id
  username     = "test@example.com"

  attributes = {
    email          = "test@example.com"
    email_verified = true
  }

  # Note: Password must be set manually via AWS CLI after creation:
  # aws cognito-idp admin-set-user-password \
  #   --user-pool-id <pool-id> \
  #   --username test@example.com \
  #   --password "TestPassword123!" \
  #   --permanent
}

# Outputs
output "user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = aws_cognito_user_pool.main.arn
}

output "user_pool_endpoint" {
  description = "Cognito User Pool endpoint"
  value       = aws_cognito_user_pool.main.endpoint
}

output "app_client_id" {
  description = "Cognito App Client ID"
  value       = aws_cognito_user_pool_client.main.id
}

output "app_client_secret" {
  description = "Cognito App Client Secret"
  value       = aws_cognito_user_pool_client.main.client_secret
  sensitive   = true
}

output "cognito_domain" {
  description = "Cognito hosted UI domain"
  value       = aws_cognito_user_pool_domain.main.domain
}

output "oidc_issuer_url" {
  description = "OIDC issuer URL for oauth2-proxy"
  value       = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
}

output "hosted_ui_url" {
  description = "Cognito Hosted UI URL"
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com"
}
