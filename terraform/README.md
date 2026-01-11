# Terraform Configuration for Authentication Gateway

This directory contains Terraform configuration to set up the AWS Cognito authentication infrastructure.

## Prerequisites

1. **Terraform installed**: Version 1.0 or later
2. **AWS credentials**: EC2 instance with IAM role or AWS credentials configured
3. **Existing resources**:
   - EC2 instance with IAM role `ssh-whitelist-role`
   - nginx and oauth2-proxy already configured

## Files

- `cognito.tf` - Cognito User Pool, Domain, and App Client configuration
- `iam.tf` - IAM policies for EC2 instance to manage Cognito
- `README.md` - This file

## Usage

### Initialize Terraform

```bash
cd /home/ubuntu/src/website-cloner/terraform
terraform init
```

### Review the Plan

```bash
terraform plan
```

This will show you what resources will be created:
- Cognito User Pool
- Cognito User Pool Domain
- Cognito App Client
- IAM Policy for Cognito management
- Test user

### Apply the Configuration

```bash
terraform apply
```

Type `yes` when prompted to create the resources.

### Get Outputs

After applying, Terraform will output important values:

```bash
terraform output
```

You'll see:
- `user_pool_id` - Use this for COGNITO_USER_POOL_ID
- `app_client_id` - Use this for COGNITO_APP_CLIENT_ID
- `app_client_secret` - Use this for COGNITO_APP_CLIENT_SECRET (sensitive)
- `cognito_domain` - The domain prefix for hosted UI
- `oidc_issuer_url` - Use this in oauth2-proxy config
- `hosted_ui_url` - The full hosted UI URL

### Get Sensitive Outputs

To see the app client secret:

```bash
terraform output -raw app_client_secret
```

### Configure oauth2-proxy

After applying Terraform, update your oauth2-proxy configuration:

```bash
# Get outputs
USER_POOL_ID=$(terraform output -raw user_pool_id)
CLIENT_ID=$(terraform output -raw app_client_id)
CLIENT_SECRET=$(terraform output -raw app_client_secret)
OIDC_ISSUER=$(terraform output -raw oidc_issuer_url)

# Update oauth2-proxy config
cat > /tmp/oauth2-proxy.cfg <<EOF
provider = "oidc"
provider_display_name = "AWS Cognito"
oidc_issuer_url = "$OIDC_ISSUER"
client_id = "$CLIENT_ID"
client_secret = "$CLIENT_SECRET"
redirect_url = "https://52.43.35.1/oauth2/callback"
email_domains = ["*"]
cookie_secret = "$(openssl rand -base64 32 | head -c 32)"
cookie_domains = ["52.43.35.1"]
http_address = "127.0.0.1:4180"
upstreams = ["http://127.0.0.1:8080"]
set_xauthrequest = true
pass_user_headers = true
skip_provider_button = true
scope = "openid email profile"
EOF

# Restart oauth2-proxy
pkill oauth2-proxy
/usr/local/bin/oauth2-proxy --config=/tmp/oauth2-proxy.cfg > /tmp/oauth2-proxy.log 2>&1 &
```

### Set Test User Password

The test user is created without a password. Set it manually:

```bash
USER_POOL_ID=$(terraform output -raw user_pool_id)

aws cognito-idp admin-set-user-password \
  --user-pool-id "$USER_POOL_ID" \
  --username "test@example.com" \
  --password "TestPassword123!" \
  --permanent \
  --region us-east-1
```

## Destroy Resources

To remove all Cognito resources:

```bash
terraform destroy
```

⚠️ **Warning**: This will delete the User Pool and all users!

## State Management

The Terraform state file (`terraform.tfstate`) contains sensitive information including the app client secret.

**For production**:
- Use remote state storage (S3 + DynamoDB)
- Enable state file encryption
- Restrict access to state files

Example remote state configuration:

```hcl
terraform {
  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "auth-gateway/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}
```

## Customization

### Change Domain Prefix

Edit `cognito.tf` and modify the `domain_prefix` variable:

```hcl
variable "domain_prefix" {
  default = "my-custom-prefix"
}
```

Or pass it during apply:

```bash
terraform apply -var="domain_prefix=my-custom-prefix"
```

### Change Region

```bash
terraform apply -var="aws_region=us-west-2"
```

### Change Callback URLs

Edit `cognito.tf`:

```hcl
variable "callback_url" {
  default = "https://yourdomain.com/oauth2/callback"
}

variable "logout_url" {
  default = "https://yourdomain.com/"
}
```

### Enable MFA

Edit `cognito.tf`:

```hcl
resource "aws_cognito_user_pool" "main" {
  # ...
  mfa_configuration = "OPTIONAL"  # or "ON"

  # Add SMS configuration if using SMS MFA
}
```

## Troubleshooting

### Domain already exists

If you get an error about domain already existing:

```bash
# List existing domains
aws cognito-idp list-user-pools --max-results 60 --region us-east-1

# Delete old domain
aws cognito-idp delete-user-pool-domain \
  --domain <old-domain> \
  --user-pool-id <pool-id> \
  --region us-east-1
```

### Import existing resources

If you manually created resources and want to import them:

```bash
# Import User Pool
terraform import aws_cognito_user_pool.main us-east-1_XXXXXXXXX

# Import App Client
terraform import aws_cognito_user_pool_client.main us-east-1_XXXXXXXXX/<client-id>
```

## Next Steps

1. Apply this Terraform configuration
2. Configure oauth2-proxy with the outputs
3. Test the authentication flow
4. Set up SSL certificates (Let's Encrypt) for production
5. Configure monitoring and logging
