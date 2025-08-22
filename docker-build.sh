#!/bin/bash

echo "🐳 Building Docker image for MP Payment Links..."

# Use production Dockerfile if it exists, otherwise use default
if [ -f "Dockerfile.production" ]; then
    echo "📦 Using Dockerfile.production..."
    docker build -f Dockerfile.production -t mp-payment-links:latest .
else
    echo "📦 Using default Dockerfile..."
    docker build -t mp-payment-links:latest .
fi

if [ $? -eq 0 ]; then
    echo "✅ Docker build successful!"
    echo ""
    echo "To run the container:"
    echo "docker run -p 3000:3000 --env-file .env mp-payment-links:latest"
else
    echo "❌ Docker build failed!"
    echo ""
    echo "Trying alternative build method..."
    
    # Try with buildkit disabled
    DOCKER_BUILDKIT=0 docker build -t mp-payment-links:latest .
    
    if [ $? -eq 0 ]; then
        echo "✅ Alternative build successful!"
    else
        echo "❌ Build failed. Please check the error messages above."
        exit 1
    fi
fi