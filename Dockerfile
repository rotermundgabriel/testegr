# Use Node.js 18.20.4 LTS
FROM node:18.20.4-alpine

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++ 

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci && \
    npm rebuild better-sqlite3 && \
    npm prune --production

# Copy application files
COPY . .

# Create database directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "src/app.js"]