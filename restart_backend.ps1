# Script to restart the backend server
Write-Host "Stopping any running Python processes on port 8000..." -ForegroundColor Yellow

# Find and kill processes on port 8000
$connections = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($connections) {
    foreach ($conn in $connections) {
        $processId = $conn.OwningProcess
        Write-Host "Stopping process $processId" -ForegroundColor Yellow
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
}

Write-Host "Starting backend server..." -ForegroundColor Green

# Change to backend directory and start server
Set-Location -Path "C:\Users\MenaceXnadin\Documents\FinalYearProject\backend"

# Activate virtual environment and start uvicorn
& ".\venv\Scripts\Activate.ps1"
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
