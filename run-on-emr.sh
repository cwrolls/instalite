#!/bin/bash

# This script guides the user through setting up and running a Spark job on EMR via Livy

# Ensure the script exits on any error
set -e

# Get the location of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "==========================================================="
echo "  SocialRankJob Deployment to EMR                          "
echo "==========================================================="
echo ""

# Check if Java is installed
if ! command -v java &> /dev/null; then
    echo "Java is not installed. Please install Java 8 or higher."
    exit 1
fi

# Check if Maven is installed
if ! command -v mvn &> /dev/null; then
    echo "Maven is not installed. Please install Maven."
    exit 1
fi

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "AWS CLI is not installed. Please install AWS CLI."
    exit 1
fi

echo "Step 1: Setting up your AWS credentials"
echo "----------------------------------------"

# Check for existing AWS credentials
if [ -f .env ]; then
    source .env
    echo "Found existing AWS credentials in .env file."
else
    echo "No .env file found. Let's create one."
    
    echo "Enter your AWS Access Key ID:"
    read ACCESS_KEY_ID
    
    echo "Enter your AWS Secret Access Key:"
    read SECRET_ACCESS_KEY
    
    echo "Enter your AWS Session Token (leave empty if none):"
    read SESSION_TOKEN
    
    echo "Enter your S3 bucket name for JAR storage:"
    read S3_BUCKET
    
    # Create .env file
    cat > .env << EOF
# AWS credentials
ACCESS_KEY_ID=$ACCESS_KEY_ID
SECRET_ACCESS_KEY=$SECRET_ACCESS_KEY
SESSION_TOKEN=$SESSION_TOKEN

# S3 storage
S3_BUCKET=$S3_BUCKET

# Database configuration (update as needed)
DATABASE_SERVER=instalite-attempt-2.chawsieycuon.us-east-1.rds.amazonaws.com
DATABASE_NAME=instalite
DATABASE_USER=nets2120project
DATABASE_PASSWORD=nets2120project

# Livy host (your EMR cluster's public DNS)
LIVY_HOST=localhost
EOF
    
    echo ".env file created successfully."
fi

echo ""
echo "Step 2: Building the JAR file"
echo "----------------------------------------"

echo "Building project with Maven..."
mvn clean package

if [ ! -f "target/instalite-spark-1.0-SNAPSHOT.jar" ]; then
    echo "Failed to build JAR file. Check the Maven output above."
    exit 1
fi

echo "JAR file built successfully."

echo ""
echo "Step 3: Setting up SSH tunnel to EMR"
echo "----------------------------------------"

echo "Please enter your EMR cluster's public DNS (e.g., ec2-xx-xxx-xxx-xxx.compute-1.amazonaws.com):"
read EMR_DNS

# Update .env file with the EMR DNS
sed -i "s|LIVY_HOST=.*|LIVY_HOST=$EMR_DNS|" .env
source .env

echo "Before continuing, make sure you've set up an SSH tunnel to your EMR cluster in another terminal:"
echo ""
echo "  ssh -i ~/.ssh/nets2120_ssh_keypair.pem -L 8998:localhost:8998 hadoop@$EMR_DNS"
echo ""
echo "This should be running in another terminal window."
echo ""

echo "Have you set up the SSH tunnel? (y/n)"
read TUNNEL_READY

if [ "$TUNNEL_READY" != "y" ]; then
    echo "Please set up the SSH tunnel and then re-run this script."
    exit 1
fi

echo ""
echo "Step 4: Submitting the job to Livy"
echo "----------------------------------------"

echo "Submitting the job to Livy..."
./submit-to-livy.sh --bucket "$S3_BUCKET"

echo ""
echo "Job submission process completed."
echo "Check the output above for the job status and any error messages."
echo ""
echo "To monitor your job, visit the Livy UI at: http://localhost:8998"
echo "or check the resource manager at: http://localhost:8088" 