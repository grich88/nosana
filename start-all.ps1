# Start Both Frontend and Backend Services
Write-Host "🚀 Starting Nosana GitHub Insights Agent Services..." -ForegroundColor Green

# Start Backend (GitHub Insights Agent API)
Write-Host "📡 Starting Backend API on port 3000..." -ForegroundColor Cyan
$backendJob = Start-Job -ScriptBlock {
    Set-Location "C:\Nosana bounty ai agent"
    npm run dev
}

# Wait a moment for backend to start
Start-Sleep -Seconds 3

# Start Frontend (React UI)
Write-Host "🌐 Starting Frontend UI on port 3001..." -ForegroundColor Cyan
$frontendJob = Start-Job -ScriptBlock {
    Set-Location "C:\Nosana bounty ai agent\frontend"
    $env:PORT = "3001"
    npm start
}

Write-Host ""
Write-Host "✨ Services Starting..." -ForegroundColor Yellow
Write-Host "📡 Backend API: http://localhost:3000" -ForegroundColor Green
Write-Host "🌐 Frontend UI: http://localhost:3001" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Red

# Wait for both jobs and display output
try {
    while ($true) {
        # Check if jobs are still running
        if ($backendJob.State -eq "Completed" -or $backendJob.State -eq "Failed") {
            Write-Host "❌ Backend job ended" -ForegroundColor Red
            break
        }
        if ($frontendJob.State -eq "Completed" -or $frontendJob.State -eq "Failed") {
            Write-Host "❌ Frontend job ended" -ForegroundColor Red
            break
        }
        
        Start-Sleep -Seconds 1
    }
} finally {
    # Cleanup: Stop all jobs
    Write-Host "🛑 Stopping services..." -ForegroundColor Yellow
    Stop-Job $backendJob, $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob, $frontendJob -ErrorAction SilentlyContinue
    Write-Host "✅ All services stopped" -ForegroundColor Green
} 