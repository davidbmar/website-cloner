# IAM Policy for EC2 instance to manage Cognito resources
# This policy should be attached to the EC2 instance role

data "aws_iam_role" "ec2_role" {
  name = "ssh-whitelist-role"
}

# IAM Policy Document for Cognito permissions
data "aws_iam_policy_document" "cognito_management" {
  statement {
    sid    = "CognitoUserPoolManagement"
    effect = "Allow"

    actions = [
      "cognito-idp:CreateUserPool",
      "cognito-idp:CreateUserPoolDomain",
      "cognito-idp:CreateUserPoolClient",
      "cognito-idp:DescribeUserPool",
      "cognito-idp:DescribeUserPoolClient",
      "cognito-idp:DescribeUserPoolDomain",
      "cognito-idp:ListUserPools",
      "cognito-idp:ListUserPoolClients",
      "cognito-idp:UpdateUserPool",
      "cognito-idp:UpdateUserPoolClient",
      "cognito-idp:DeleteUserPool",
      "cognito-idp:DeleteUserPoolDomain",
      "cognito-idp:AdminCreateUser",
      "cognito-idp:AdminSetUserPassword",
      "cognito-idp:AdminGetUser",
      "cognito-idp:AdminDeleteUser",
      "cognito-idp:ListUsers",
    ]

    resources = ["*"]
  }
}

# Create IAM policy
resource "aws_iam_policy" "cognito_management" {
  name        = "CognitoUserPoolManagement"
  description = "Allows EC2 instance to manage Cognito User Pools"
  policy      = data.aws_iam_policy_document.cognito_management.json

  tags = {
    Name      = "cognito-management-policy"
    ManagedBy = "terraform"
  }
}

# Attach policy to existing EC2 role
resource "aws_iam_role_policy_attachment" "cognito_management" {
  role       = data.aws_iam_role.ec2_role.name
  policy_arn = aws_iam_policy.cognito_management.arn
}

output "iam_policy_arn" {
  description = "ARN of the Cognito management IAM policy"
  value       = aws_iam_policy.cognito_management.arn
}
