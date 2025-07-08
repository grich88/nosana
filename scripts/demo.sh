#!/bin/bash

# Nosana GitHub Insights Agent Demo Script
echo "🤖 Nosana GitHub Insights Agent Demo"
echo "===================================="

# Check if server is running
if ! curl -s http://localhost:3000/health > /dev/null; then
    echo "❌ Server not running. Please start with: npm run dev"
    exit 1
fi

echo "✅ Server is running!"
echo ""

# Test 1: Agent Info
echo "📋 1. Getting agent information..."
curl -s http://localhost:3000/agent-info | jq '.'
echo -e "\n"

# Test 2: Popular Repository Analysis
echo "📊 2. Analyzing microsoft/vscode..."
curl -s -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Show me stats for microsoft/vscode"}' | jq '.response'
echo -e "\n"

# Test 3: Another Repository
echo "📊 3. Analyzing facebook/react..."
curl -s -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Analyze facebook/react"}' | jq '.response'
echo -e "\n"

# Test 4: URL-based Query
echo "📊 4. Analyzing from GitHub URL..."
curl -s -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What can you tell me about https://github.com/vercel/next.js?"}' | jq '.response'
echo -e "\n"

# Test 5: Health Assessment Focus
echo "🏥 5. Health assessment focus..."
curl -s -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the health status of torvalds/linux?"}' | jq '.response'
echo -e "\n"

echo "🎉 Demo completed! The agent is working properly."
echo "📝 To test with your own repositories, use:"
echo "curl -X POST http://localhost:3000/chat -H \"Content-Type: application/json\" -d '{\"message\": \"Show me stats for owner/repo\"}'" 