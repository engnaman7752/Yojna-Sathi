#!/usr/bin/env bash
#
# Creates the single DynamoDB table "YojanaSaathi" with the three GSIs from
# PROJECT_BRIEF.md. Safe to re-run: it exits cleanly if the table already exists.
#
# Local:  DDB_ENDPOINT=http://localhost:8001 ./infra/create-table.sh
# AWS:    AWS_REGION=ap-south-1 ./infra/create-table.sh
#
# The only difference between the two is whether --endpoint-url is passed, so the
# table definition itself cannot drift between local and deployed.

set -euo pipefail

TABLE="${DDB_TABLE:-YojanaSaathi}"
REGION="${AWS_REGION:-ap-south-1}"
ENDPOINT="${DDB_ENDPOINT:-}"

aws_ddb() {
  if [[ -n "$ENDPOINT" ]]; then
    aws dynamodb --endpoint-url "$ENDPOINT" --region "$REGION" "$@"
  else
    aws dynamodb --region "$REGION" "$@"
  fi
}

command -v aws >/dev/null 2>&1 || { echo "aws CLI not found on PATH." >&2; exit 1; }

echo "Table   : $TABLE"
echo "Region  : $REGION"
echo "Endpoint: ${ENDPOINT:-<real AWS>}"

if aws_ddb describe-table --table-name "$TABLE" >/dev/null 2>&1; then
  echo "Table '$TABLE' already exists. Nothing to do."
  exit 0
fi

# Entity keys (PROJECT_BRIEF.md):
#   Scheme (current)   SCHEME#<id>          CURRENT
#   Scheme version     SCHEME#<id>          VERSION#<n>
#   Scheme document    SCHEME#<id>          DOC#<docId>
#   Index status       SCHEME#<id>          INDEX#<version>
#   Import job         IMPORT#<jobId>       STATUS
#   Household profile  HOUSEHOLD#<id>       PROFILE
#   Consent            HOUSEHOLD#<id>       CONSENT#<operatorId>
#   Eligibility result HOUSEHOLD#<id>       RESULT#<iso-timestamp>
#   Access log         HOUSEHOLD#<id>       ACCESS#<iso>#<userId>
#   User               USER#<id>            PROFILE
#
# GSI1  OPERATOR#<id>        / HOUSEHOLD#<id>   operator's households
# GSI2  DISTRICT#<name>      / HOUSEHOLD#<id>   district officer's households
# GSI3  IMPORT_STATUS#<st>   / <createdAt>      admin draft queue
#
# Only items that participate in an index carry its key attributes, so the
# indexes stay sparse and a household with no operator never appears in GSI1.

echo "Creating table '$TABLE'..."
aws_ddb create-table \
  --table-name "$TABLE" \
  --billing-mode PAY_PER_REQUEST \
  --attribute-definitions \
      AttributeName=PK,AttributeType=S \
      AttributeName=SK,AttributeType=S \
      AttributeName=GSI1PK,AttributeType=S \
      AttributeName=GSI1SK,AttributeType=S \
      AttributeName=GSI2PK,AttributeType=S \
      AttributeName=GSI2SK,AttributeType=S \
      AttributeName=GSI3PK,AttributeType=S \
      AttributeName=GSI3SK,AttributeType=S \
  --key-schema \
      AttributeName=PK,KeyType=HASH \
      AttributeName=SK,KeyType=RANGE \
  --global-secondary-indexes '[
    {
      "IndexName": "GSI1",
      "KeySchema": [
        {"AttributeName": "GSI1PK", "KeyType": "HASH"},
        {"AttributeName": "GSI1SK", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    },
    {
      "IndexName": "GSI2",
      "KeySchema": [
        {"AttributeName": "GSI2PK", "KeyType": "HASH"},
        {"AttributeName": "GSI2SK", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    },
    {
      "IndexName": "GSI3",
      "KeySchema": [
        {"AttributeName": "GSI3PK", "KeyType": "HASH"},
        {"AttributeName": "GSI3SK", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    }
  ]' \
  --no-cli-pager >/dev/null

echo "Waiting for '$TABLE' to become ACTIVE..."
aws_ddb wait table-exists --table-name "$TABLE"

# PROJECT_BRIEF.md: "Build consent sets from unexpired consent rows only;
# DynamoDB TTL on expiresAt." DynamoDB Local accepts this call but does not
# actually expire items, so the consent query must still filter on expiresAt
# rather than trusting TTL to have removed the row.
echo "Enabling TTL on 'expiresAt'..."
aws_ddb update-time-to-live \
  --table-name "$TABLE" \
  --time-to-live-specification "Enabled=true,AttributeName=expiresAt" \
  --no-cli-pager >/dev/null 2>&1 \
  || echo "  (TTL could not be enabled - DynamoDB Local sometimes rejects this; harmless locally.)"

echo "Done. Table '$TABLE' is ready."
