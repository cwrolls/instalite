#!/bin/bash

# Ensure the script exits on any error
set -e

# Get the location of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Default values
JAR_FILE="target/instalite-spark-1.0-SNAPSHOT.jar"
LIVY_URL="http://ec2-44-202-26-172.compute-1.amazonaws.com:8998/"
MAIN_CLASS="edu.upenn.cis.nets2120.hw3.spark.SocialRankJob"
S3_BUCKET="" # Default empty, will be prompted if needed

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --jar)
      JAR_FILE="$2"
      shift 2
      ;;
    --livy)
      LIVY_URL="$2"
      shift 2
      ;;
    --class)
      MAIN_CLASS="$2"
      shift 2
      ;;
    --bucket)
      S3_BUCKET="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Verify the JAR file exists
if [ ! -f "$JAR_FILE" ]; then
  echo "JAR file not found: $JAR_FILE"
  echo "Make sure to run 'mvn package' first"
  exit 1
fi

# Get absolute path to JAR
JAR_PATH=$(realpath "$JAR_FILE")

echo "Submitting job to Livy at $LIVY_URL"
echo "JAR file: $JAR_PATH"
echo "Main class: $MAIN_CLASS"

# Get AWS credentials if we have a .env file
if [ -f .env ]; then
  source .env
fi

# Ask for S3 bucket if not provided
if [ -z "$S3_BUCKET" ]; then
  echo "Please enter your S3 bucket name (e.g., nets2120-project-bucket):"
  read S3_BUCKET
fi

# Upload to S3
S3_PREFIX="livy-jobs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
JAR_BASENAME=$(basename "$JAR_PATH")
S3_KEY="$S3_PREFIX/$TIMESTAMP-$JAR_BASENAME"
S3_PATH="s3://$S3_BUCKET/$S3_KEY"

echo "Uploading JAR to S3: $S3_PATH"

# Use AWS CLI to upload the JAR
# First check if AWS credentials are available
if [ -z "$ACCESS_KEY_ID" ] || [ -z "$SECRET_ACCESS_KEY" ]; then
  echo "AWS credentials not found in .env file."
  echo "Please enter your AWS ACCESS_KEY_ID:"
  read ACCESS_KEY_ID
  echo "Please enter your AWS SECRET_ACCESS_KEY:"
  read SECRET_ACCESS_KEY
fi

# Set AWS credentials for the S3 upload
export AWS_ACCESS_KEY_ID="$ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$SECRET_ACCESS_KEY"
if [ -n "$SESSION_TOKEN" ]; then
  export AWS_SESSION_TOKEN="$SESSION_TOKEN"
fi

# Upload the JAR to S3
aws s3 cp "$JAR_PATH" "$S3_PATH"

echo "JAR uploaded to S3. Using S3 path for submission."

# Create a JSON payload for the Livy REST API
JSON_PAYLOAD=$(cat <<EOF
{
  "file": "$S3_PATH",
  "className": "$MAIN_CLASS",
  "conf": {
    "spark.driver.memory": "4g",
    "spark.executor.memory": "4g"
  }
}
EOF
)

# Submit the job
echo "Submitting job to Livy..."
RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "$JSON_PAYLOAD" "$LIVY_URL/batches")

# Extract the batch ID from the response
BATCH_ID=$(echo "$RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)

if [ -z "$BATCH_ID" ]; then
  echo "Failed to submit job to Livy. Response: $RESPONSE"
  exit 1
else
  echo "Job submitted successfully. Batch ID: $BATCH_ID"
  echo "To check the status of your job, run:"
  echo "curl $LIVY_URL/batches/$BATCH_ID"
  echo "To view the logs, run:"
  echo "curl $LIVY_URL/batches/$BATCH_ID/log"
  
  # Wait a moment for the job to start
  echo "Waiting for job to initialize..."
  sleep 5
  
  # Get the job state
  echo "Checking job state..."
  STATE_RESPONSE=$(curl -s "$LIVY_URL/batches/$BATCH_ID")
  STATE=$(echo "$STATE_RESPONSE" | grep -o '"state":"[^"]*"' | cut -d':' -f2 | tr -d '"')
  
  echo "Job state: $STATE"
  
  # If job failed, is dead, or is still starting, get the logs
  if [ "$STATE" = "dead" ] || [ "$STATE" = "error" ] || [ "$STATE" = "starting" ]; then
    echo "Getting logs..."
    LOG_RESPONSE=$(curl -s "$LIVY_URL/batches/$BATCH_ID/log")
    echo "Job logs:"
    echo "$LOG_RESPONSE"
  fi
  
  # Continue to monitor for a short time if the job is still starting
  if [ "$STATE" = "starting" ]; then
    echo "Job is still starting. Waiting for 10 more seconds..."
    sleep 10
    STATE_RESPONSE=$(curl -s "$LIVY_URL/batches/$BATCH_ID")
    STATE=$(echo "$STATE_RESPONSE" | grep -o '"state":"[^"]*"' | cut -d':' -f2 | tr -d '"')
    echo "Updated job state: $STATE"
    
    if [ "$STATE" = "dead" ] || [ "$STATE" = "error" ]; then
      echo "Job failed. Getting updated logs..."
      LOG_RESPONSE=$(curl -s "$LIVY_URL/batches/$BATCH_ID/log")
      echo "Updated job logs:"
      echo "$LOG_RESPONSE"
    elif [ "$STATE" = "running" ]; then
      echo "Job is now running!"
    fi
  fi
fi 