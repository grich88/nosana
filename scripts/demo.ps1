# Nosana GitHub Insights Agent Demo Script (PowerShell)
Write-Host "🤖 Nosana GitHub Insights Agent Demo" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# Check if server is running
try {
    $healthCheck = Invoke-RestMethod -Uri "http://localhost:3000/health" -Method Get -ErrorAction Stop
    Write-Host "✅ Server is running!" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ Server not running. Please start with: npm run dev" -ForegroundColor Red
    exit 1
}

# Test 1: Agent Info
Write-Host "📋 1. Getting agent information..." -ForegroundColor Yellow
$agentInfo = Invoke-RestMethod -Uri "http://localhost:3000/agent-info" -Method Get
$agentInfo | ConvertTo-Json -Depth 3 | Write-Host
Write-Host ""

# Test 2: Popular Repository Analysis
Write-Host "📊 2. Analyzing microsoft/vscode..." -ForegroundColor Yellow
$body1 = @{ message = "Show me stats for microsoft/vscode" } | ConvertTo-Json
$response1 = Invoke-RestMethod -Uri "http://localhost:3000/chat" -Method Post -Body $body1 -ContentType "application/json"
Write-Host $response1.response
Write-Host ""

# Test 3: Another Repository
Write-Host "📊 3. Analyzing facebook/react..." -ForegroundColor Yellow
$body2 = @{ message = "Analyze facebook/react" } | ConvertTo-Json
$response2 = Invoke-RestMethod -Uri "http://localhost:3000/chat" -Method Post -Body $body2 -ContentType "application/json"
Write-Host $response2.response
Write-Host ""

# Test 4: URL-based Query
Write-Host "📊 4. Analyzing from GitHub URL..." -ForegroundColor Yellow
$body3 = @{ message = "What can you tell me about https://github.com/vercel/next.js?" } | ConvertTo-Json
$response3 = Invoke-RestMethod -Uri "http://localhost:3000/chat" -Method Post -Body $body3 -ContentType "application/json"
Write-Host $response3.response
Write-Host ""

# Test 5: Health Assessment Focus
Write-Host "🏥 5. Health assessment focus..." -ForegroundColor Yellow
$body4 = @{ message = "What is the health status of torvalds/linux?" } | ConvertTo-Json
$response4 = Invoke-RestMethod -Uri "http://localhost:3000/chat" -Method Post -Body $body4 -ContentType "application/json"
Write-Host $response4.response
Write-Host ""

Write-Host "🎉 Demo completed! The agent is working properly." -ForegroundColor Green
Write-Host "📝 To test with your own repositories, use PowerShell:" -ForegroundColor Cyan
Write-Host '    $body = @{ message = "Show me stats for owner/repo" } | ConvertTo-Json' -ForegroundColor Gray
Write-Host '    Invoke-RestMethod -Uri "http://localhost:3000/chat" -Method Post -Body $body -ContentType "application/json"' -ForegroundColor Gray 