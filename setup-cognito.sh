#!/bin/bash

# Cognito Setup Script
# This script provides instructions for setting up AWS Cognito
# Run this after updating IAM permissions or use AWS Console

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║         AWS Cognito Setup for Website Cloner            ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check if IAM role has Cognito permissions
echo "Checking IAM permissions..."
if aws cognito-idp list-user-pools --max-results 1 --region us-east-1 2>/dev/null; then
    echo "✅ IAM role has Cognito permissions"
    HAS_PERMISSIONS=true
else
    echo "❌ IAM role missing Cognito permissions"
    HAS_PERMISSIONS=false
fi

echo ""

if [ "$HAS_PERMISSIONS" = false ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  OPTION 1: Add IAM Permissions (Recommended)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Add this policy to your IAM role: ssh-whitelist-role"
    echo ""
    cat <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cognito-idp:CreateUserPool",
        "cognito-idp:CreateUserPoolDomain",
        "cognito-idp:CreateUserPoolClient",
        "cognito-idp:DescribeUserPool",
        "cognito-idp:DescribeUserPoolClient",
        "cognito-idp:ListUserPools",
        "cognito-idp:AdminCreateUser",
        "cognito-idp:AdminSetUserPassword"
      ],
      "Resource": "*"
    }
  ]
}
EOF
    echo ""
    echo "Then run: ./setup-cognito.sh --create"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  OPTION 2: AWS Console (Manual Setup)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "1. Go to: https://console.aws.amazon.com/cognito"
    echo "2. Click 'Create user pool'"
    echo "3. Configure:"
    echo "   - Provider: Cognito User Pool"
    echo "   - Sign-in: Email"
    echo "   - Password: Min 8 chars, uppercase, lowercase, numbers"
    echo "   - MFA: Optional (off for now)"
    echo "   - User pool name: website-cloner-users"
    echo "4. Create app client:"
    echo "   - Client name: website-cloner-app"
    echo "   - Generate client secret: YES"
    echo "   - OAuth flows: Authorization code grant"
    echo "   - Callback URLs: http://52.43.35.1:3000/callback"
    echo "   - Logout URLs: http://52.43.35.1:3000/"
    echo "5. Create hosted UI domain:"
    echo "   - Domain: website-cloner-auth (or your choice)"
    echo "6. Copy values to .env file"
    echo ""
    exit 1
fi

# If we have permissions, create the Cognito resources
if [ "$1" = "--create" ]; then
    echo "Creating Cognito User Pool..."

    # Create User Pool
    USER_POOL_OUTPUT=$(aws cognito-idp create-user-pool \
        --pool-name website-cloner-users \
        --auto-verified-attributes email \
        --username-attributes email \
        --mfa-configuration OFF \
        --policies file:///tmp/cognito-policy.json \
        --region us-east-1 \
        --output json)

    USER_POOL_ID=$(echo "$USER_POOL_OUTPUT" | jq -r '.UserPool.Id')

    echo "✅ User Pool created: $USER_POOL_ID"

    # Create User Pool Domain
    DOMAIN_NAME="website-cloner-auth-$(date +%s)"
    aws cognito-idp create-user-pool-domain \
        --domain "$DOMAIN_NAME" \
        --user-pool-id "$USER_POOL_ID" \
        --region us-east-1

    echo "✅ Domain created: $DOMAIN_NAME"

    # Create App Client
    APP_CLIENT_OUTPUT=$(aws cognito-idp create-user-pool-client \
        --user-pool-id "$USER_POOL_ID" \
        --client-name website-cloner-app \
        --generate-secret \
        --allowed-o-auth-flows code \
        --allowed-o-auth-scopes openid email profile \
        --callback-urls "http://52.43.35.1:3000/callback" \
        --logout-urls "http://52.43.35.1:3000/" \
        --supported-identity-providers COGNITO \
        --allowed-o-auth-flows-user-pool-client \
        --region us-east-1 \
        --output json)

    APP_CLIENT_ID=$(echo "$APP_CLIENT_OUTPUT" | jq -r '.UserPoolClient.ClientId')
    APP_CLIENT_SECRET=$(echo "$APP_CLIENT_OUTPUT" | jq -r '.UserPoolClient.ClientSecret')

    echo "✅ App Client created: $APP_CLIENT_ID"

    # Generate random session secret
    SESSION_SECRET=$(openssl rand -hex 32)

    # Create .env file
    cat > .env <<EOF
# Cognito Configuration
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=$USER_POOL_ID
COGNITO_APP_CLIENT_ID=$APP_CLIENT_ID
COGNITO_APP_CLIENT_SECRET=$APP_CLIENT_SECRET
COGNITO_DOMAIN=$DOMAIN_NAME

# Session Configuration
SESSION_SECRET=$SESSION_SECRET
SESSION_MAX_AGE=86400000

# Server Configuration
PORT=3000
NODE_ENV=development
EOF

    echo ""
    echo "✅ Configuration saved to .env"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Next Steps:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "1. Install dependencies:"
    echo "   npm install express-session passport passport-oauth2 dotenv jsonwebtoken jwks-rsa"
    echo ""
    echo "2. Create a test user:"
    echo "   aws cognito-idp admin-create-user \\"
    echo "     --user-pool-id $USER_POOL_ID \\"
    echo "     --username test@example.com \\"
    echo "     --user-attributes Name=email,Value=test@example.com \\"
    echo "     --temporary-password 'TempPass123!' \\"
    echo "     --message-action SUPPRESS \\"
    echo "     --region us-east-1"
    echo ""
    echo "   aws cognito-idp admin-set-user-password \\"
    echo "     --user-pool-id $USER_POOL_ID \\"
    echo "     --username test@example.com \\"
    echo "     --password 'Password123!' \\"
    echo "     --permanent \\"
    echo "     --region us-east-1"
    echo ""
    echo "3. Restart the server:"
    echo "   pm2 restart server"
    echo ""
    echo "4. Test authentication:"
    echo "   http://52.43.35.1:3000/login"
    echo ""
else
    echo "Run './setup-cognito.sh --create' to create Cognito resources"
fi
