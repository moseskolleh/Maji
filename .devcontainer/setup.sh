#!/bin/bash
set -e

echo "🚀 Setting up Maji Water Platform..."

# Start PostgreSQL container
echo "📦 Starting PostgreSQL..."
docker run -d --name maji-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=maji \
  -p 5432:5432 \
  postgres:15-alpine

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to start..."
sleep 5

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install

# Set up database
echo "🗄️ Setting up database..."
node test-db.js

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the server, run:"
echo "  cd backend && node test-server.js"
echo ""
echo "Then open http://localhost:3000/health in your browser"
echo ""
