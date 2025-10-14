#!/bin/bash
echo ""
echo "==========================================================================="
echo "    ____  ___    ____  ________  "
echo "   / __ \\/   |  / __ \\/  _/ __ \\ "
echo "  / /_/ / /| | / /_/ // // / / / "
echo " / _, _/ ___ |/ ____// // /_/ /  "
echo "/_/ |_/_/  |_/_/   /___/_____/   "
echo ""
echo "Review & Assessment Powered by Intelligent Documentation"
echo "---------------------------------------------------------------------------"
echo "  This script deploys the RAPID application using AWS CodeBuild."
echo "  No local environment dependencies - deployment runs entirely in AWS."
echo ""
echo "  ⚠️  WARNING: Auto-migration is enabled by default."
echo "     For production environments, consider using --auto-migrate=false"
echo "==========================================================================="
echo ""

# Default parameters
ALLOWED_IPV4_RANGES='["0.0.0.0/1","128.0.0.0/1"]'
ALLOWED_IPV6_RANGES='["0000:0000:0000:0000:0000:0000:0000:0000/1","8000:0000:0000:0000:0000:0000:0000:0000/1"]'
DISABLE_IPV6="false"
AUTO_MIGRATE="true"
COGNITO_SELF_SIGNUP_ENABLED="true"
COGNITO_USER_POOL_ID=""
COGNITO_USER_POOL_CLIENT_ID=""
COGNITO_DOMAIN_PREFIX=""
MCP_ADMIN="false"
BEDROCK_REGION="us-west-2"
DOCUMENT_PROCESSING_MODEL_ID=""
IMAGE_REVIEW_MODEL_ID=""
REPO_URL="https://github.com/aws-samples/review-and-assessment-powered-by-intelligent-documentation.git"
BRANCH="main"
GIT_TAG=""

# Parse command line arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --ipv4-ranges) ALLOWED_IPV4_RANGES="$2"; shift ;;
        --ipv6-ranges) ALLOWED_IPV6_RANGES="$2"; shift ;;
        --disable-ipv6) DISABLE_IPV6="true" ;;
        --auto-migrate) AUTO_MIGRATE="$2"; shift ;;
        --cognito-self-signup) COGNITO_SELF_SIGNUP_ENABLED="$2"; shift ;;
        --cognito-user-pool-id) COGNITO_USER_POOL_ID="$2"; shift ;;
        --cognito-user-pool-client-id) COGNITO_USER_POOL_CLIENT_ID="$2"; shift ;;
        --cognito-domain-prefix) COGNITO_DOMAIN_PREFIX="$2"; shift ;;
        --mcp-admin) MCP_ADMIN="$2"; shift ;;
        --bedrock-region) BEDROCK_REGION="$2"; shift ;;
        --document-model) DOCUMENT_PROCESSING_MODEL_ID="$2"; shift ;;
        --image-model) IMAGE_REVIEW_MODEL_ID="$2"; shift ;;
        --repo-url) REPO_URL="$2"; shift ;;
        --branch) BRANCH="$2"; shift ;;
        --tag) GIT_TAG="$2"; shift ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# Prepare working directory (ensure idempotency)
WORK_DIR="rapid-deploy-$(date +%s)"
if [ -d "$WORK_DIR" ]; then
    echo "Removing existing working directory: $WORK_DIR"
    rm -rf "$WORK_DIR"
fi

echo "Cloning repository..."
if [ ! -z "$GIT_TAG" ]; then
    git clone $REPO_URL "$WORK_DIR"
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to clone repository"
        exit 1
    fi
    cd "$WORK_DIR"
    git checkout $GIT_TAG
else
    git clone --branch $BRANCH $REPO_URL "$WORK_DIR"
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to clone repository"
        exit 1
    fi
    cd "$WORK_DIR"
fi
echo "Moved to working directory: $(pwd)"

# Validate CloudFormation template
aws cloudformation validate-template --template-body file://deploy.yml > /dev/null 2>&1
if [[ $? -ne 0 ]]; then
    echo "CloudFormation template validation failed"
    cd ..
    rm -rf "$WORK_DIR"
    exit 1
fi

StackName="RapidCodeBuildDeploy"

# Deploy CloudFormation stack
aws cloudformation deploy \
  --stack-name $StackName \
  --template-file deploy.yml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    AllowedIpV4AddressRanges="$ALLOWED_IPV4_RANGES" \
    AllowedIpV6AddressRanges="$ALLOWED_IPV6_RANGES" \
    DisableIpv6="$DISABLE_IPV6" \
    AutoMigrate="$AUTO_MIGRATE" \
    CognitoSelfSignUpEnabled="$COGNITO_SELF_SIGNUP_ENABLED" \
    CognitoUserPoolId="$COGNITO_USER_POOL_ID" \
    CognitoUserPoolClientId="$COGNITO_USER_POOL_CLIENT_ID" \
    CognitoDomainPrefix="$COGNITO_DOMAIN_PREFIX" \
    McpAdmin="$MCP_ADMIN" \
    BedrockRegion="$BEDROCK_REGION" \
    DocumentProcessingModelId="$DOCUMENT_PROCESSING_MODEL_ID" \
    ImageReviewModelId="$IMAGE_REVIEW_MODEL_ID" \
    RepoUrl="$REPO_URL" \
    Branch="$BRANCH" \
    GitTag="$GIT_TAG"

echo "Waiting for stack creation to complete..."
echo "Note: This stack includes a CodeBuild project used for CDK deployment."
spin='-\|/'
i=0
while true; do
    status=$(aws cloudformation describe-stacks --stack-name $StackName --query 'Stacks[0].StackStatus' --output text 2>/dev/null)
    if [[ "$status" == "CREATE_COMPLETE" || "$status" == "UPDATE_COMPLETE" || "$status" == "DELETE_COMPLETE" ]]; then
        break
    elif [[ "$status" == "ROLLBACK_COMPLETE" || "$status" == "DELETE_FAILED" || "$status" == "CREATE_FAILED" ]]; then
        echo "Stack creation failed. Status: $status"
        exit 1
    fi
    printf "\r${spin:i++%${#spin}:1}"
    sleep 1
done
echo -e "\nCompleted.\n"

outputs=$(aws cloudformation describe-stacks --stack-name $StackName --query 'Stacks[0].Outputs')
projectName=$(echo $outputs | jq -r '.[] | select(.OutputKey=="ProjectName").OutputValue')

if [[ -z "$projectName" ]]; then
    echo "Failed to get CodeBuild project name"
    cd ..
    rm -rf "$WORK_DIR"
    exit 1
fi

echo "Starting CodeBuild project: $projectName..."
buildId=$(aws codebuild start-build --project-name $projectName --query 'build.id' --output text)

if [[ -z "$buildId" ]]; then
    echo "Failed to start CodeBuild project"
    cd ..
    rm -rf "$WORK_DIR"
    exit 1
fi

echo "Waiting for CodeBuild project to complete..."
while true; do
    buildStatus=$(aws codebuild batch-get-builds --ids $buildId --query 'builds[0].buildStatus' --output text)
    if [[ "$buildStatus" == "SUCCEEDED" || "$buildStatus" == "FAILED" || "$buildStatus" == "STOPPED" ]]; then
        break
    fi
    sleep 10
done
echo "CodeBuild project completed. Status: $buildStatus"

if [[ "$buildStatus" != "SUCCEEDED" ]]; then
    echo "Build failed. Please check the logs."
    buildDetail=$(aws codebuild batch-get-builds --ids $buildId --query 'builds[0].logs.{groupName: groupName, streamName: streamName}' --output json)
    logGroupName=$(echo $buildDetail | jq -r '.groupName')
    logStreamName=$(echo $buildDetail | jq -r '.streamName')
    echo "Log Group Name: $logGroupName"
    echo "Log Stream Name: $logStreamName"
    echo "You can check the logs with the following command:"
    echo "aws logs get-log-events --log-group-name $logGroupName --log-stream-name $logStreamName"
    # Cleanup before exit
    cd ..
    rm -rf "$WORK_DIR"
    exit 1
fi

buildDetail=$(aws codebuild batch-get-builds --ids $buildId --query 'builds[0].logs.{groupName: groupName, streamName: streamName}' --output json)
logGroupName=$(echo $buildDetail | jq -r '.groupName')
logStreamName=$(echo $buildDetail | jq -r '.streamName')

echo "Retrieving CDK deployment logs..."
logs=$(aws logs get-log-events --log-group-name $logGroupName --log-stream-name $logStreamName)
frontendUrl=$(echo "$logs" | grep -o 'FrontendURL = [^ ]*' | cut -d' ' -f3 | tr -d '\n,')

# Cleanup process
cd ..
echo "Cleaning up working directory: $WORK_DIR"
rm -rf "$WORK_DIR"

echo ""
echo "==========================================================================="
echo "  🎉 Deployment completed successfully!                                    "
echo "---------------------------------------------------------------------------"
echo "  Frontend URL: $frontendUrl"
echo ""
echo "  You can check detailed logs with the following command:"
echo "  aws logs get-log-events --log-group-name $logGroupName --log-stream-name $logStreamName"
echo "==========================================================================="
