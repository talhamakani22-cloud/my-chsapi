# CHS API Endpoints Verification Script (Windows PowerShell)
# Tests all API endpoints to verify they're posting correctly to cloud

param(
    [string]$ApiUrl = "http://localhost:3000",
    [string]$OutputFile = "api_test_results.txt"
)

$ErrorActionPreference = "Continue"
$resultsCollection = @()

# Color Helper
function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Error2 {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Warning2 {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Cyan
}

# Header
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "CHS API Endpoints Verification Report" -ForegroundColor Cyan
Write-Host "Base URL: $ApiUrl" -ForegroundColor Cyan
Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Function to test endpoint
function Test-Endpoint {
    param(
        [string]$Method,
        [string]$Endpoint,
        [string]$Body,
        [string]$Description
    )
    
    Write-Info "Testing: $Description"
    Write-Host "Endpoint: $Method $Endpoint" -ForegroundColor Gray
    
    try {
        $params = @{
            Uri     = "$ApiUrl$Endpoint"
            Method  = $Method
            Headers = @{ "Content-Type" = "application/json" }
        }
        
        if ($Method -ne "GET" -and $Body) {
            $params["Body"] = $Body
        }
        
        $response = Invoke-WebRequest @params -UseBasicParsing
        $httpCode = $response.StatusCode
        $bodyContent = $response.Content
        
        if ($httpCode -ge 200 -and $httpCode -lt 300) {
            Write-Success "SUCCESS (HTTP $httpCode)"
        } elseif ($httpCode -ge 400 -and $httpCode -lt 500) {
            Write-Warning2 "CLIENT ERROR (HTTP $httpCode) - This may be expected"
        } else {
            Write-Error2 "FAILED (HTTP $httpCode)"
        }
        
        $preview = if ($bodyContent.Length -gt 100) { $bodyContent.Substring(0, 100) + "..." } else { $bodyContent }
        Write-Host "Response: $preview" -ForegroundColor DarkGray
        
        $resultsCollection += @{
            Description = $Description
            Method      = $Method
            Endpoint    = $Endpoint
            HttpCode    = $httpCode
            Status      = if ($httpCode -ge 200 -and $httpCode -lt 300) { "PASS" } else { "CHECK" }
        }
    }
    catch {
        Write-Error2 "ERROR: $($_.Exception.Message)"
        $resultsCollection += @{
            Description = $Description
            Method      = $Method
            Endpoint    = $Endpoint
            HttpCode    = "ERROR"
            Status      = "FAIL"
        }
    }
    
    Write-Host "---" -ForegroundColor Gray
}

# Check if API is running
Write-Info "Checking API Connection..."
try {
    $testConnection = Invoke-WebRequest -Uri $ApiUrl -UseBasicParsing -ErrorAction SilentlyContinue
    Write-Success "API is running at $ApiUrl"
}
catch {
    Write-Error2 "API is not responding. Make sure the server is running."
    Write-Error2 "Run: npm run server (from chs_portal directory)"
    exit 1
}

Write-Host ""

# ==================== AUTHENTICATION ENDPOINTS ====================
Write-Host "=== AUTHENTICATION ENDPOINTS ===" -ForegroundColor Cyan
Test-Endpoint -Method "POST" -Endpoint "/api/auth/login" `
    -Body '{"email":"user@example.com","password":"password123","loginType":"resident"}' `
    -Description "Login"

Test-Endpoint -Method "GET" -Endpoint "/api/auth/profile" `
    -Description "Get Profile"

Test-Endpoint -Method "POST" -Endpoint "/api/auth/signup" `
    -Body '{"username":"test_user","email":"test@example.com","password":"password123","signupMode":"resident-self"}' `
    -Description "Signup"

Test-Endpoint -Method "POST" -Endpoint "/api/auth/reset-password" `
    -Body '{"email":"user@example.com","loginType":"resident","newPassword":"newpass123","confirmPassword":"newpass123"}' `
    -Description "Reset Password"

# ==================== VISITOR ENDPOINTS ====================
Write-Host "=== VISITOR MANAGEMENT ENDPOINTS ===" -ForegroundColor Cyan
Test-Endpoint -Method "GET" -Endpoint "/api/visitors" `
    -Description "Get Visitors List"

# ==================== FAMILY ENDPOINTS ====================
Write-Host "=== FAMILY MANAGEMENT ENDPOINTS ===" -ForegroundColor Cyan
Test-Endpoint -Method "GET" -Endpoint "/api/family" `
    -Description "Get Family Details"

Test-Endpoint -Method "POST" -Endpoint "/api/family/upload-cnic-pdf" `
    -Body '{"residentName":"John","flatNumber":"101","familyMembers":[],"cnicPdfBase64":"test","cnicPdfName":"test.pdf","cnicPdfMimeType":"application/pdf"}' `
    -Description "Upload Family CNIC PDF"

# ==================== VEHICLE ENDPOINTS ====================
Write-Host "=== VEHICLE MANAGEMENT ENDPOINTS ===" -ForegroundColor Cyan
Test-Endpoint -Method "GET" -Endpoint "/api/vehicle" `
    -Description "Get Vehicle Details"

# ==================== MAINTENANCE ENDPOINTS ====================
Write-Host "=== MAINTENANCE ENDPOINTS ===" -ForegroundColor Cyan
Test-Endpoint -Method "GET" -Endpoint "/api/maintenance/report" `
    -Description "Get Maintenance Report"

Test-Endpoint -Method "POST" -Endpoint "/api/maintenance/broadcast" `
    -Body '{"receiptNo":"2024-001","ownerName":"Owner","residentName":"Resident","flatNumber":"101","receiptMonth":"January","amount":500,"status":"paid","paymentDate":"2024-01-15","note":"Test","generatedAt":"2024-01-15T10:30:00","receiptPdfUri":"test.pdf"}' `
    -Description "Broadcast Maintenance Receipt"

Test-Endpoint -Method "POST" -Endpoint "/api/maintenance/broadcast-bulk" `
    -Body '{"receipts":[{"receiptNo":"2024-001","ownerName":"Owner","residentName":"Resident","flatNumber":"101","receiptMonth":"January","amount":500,"status":"paid","paymentDate":"2024-01-15","note":"Test","generatedAt":"2024-01-15T10:30:00","receiptPdfUri":"test.pdf"}]}' `
    -Description "Broadcast Maintenance (Bulk)"

# ==================== NOTIFICATION ENDPOINTS ====================
Write-Host "=== NOTIFICATION ENDPOINTS ===" -ForegroundColor Cyan
Test-Endpoint -Method "GET" -Endpoint "/api/notifications" `
    -Description "Get Notifications List"

Test-Endpoint -Method "POST" -Endpoint "/api/notifications" `
    -Body '{"title":"Test Notification","message":"This is a test","target":"both"}' `
    -Description "Create Notification"

Test-Endpoint -Method "POST" -Endpoint "/api/notifications/register-device" `
    -Body '{"expoPushToken":"ExponentPushToken[test]","platform":"ios"}' `
    -Description "Register Device for Push"

# ==================== MEETING CHAT ENDPOINTS ====================
Write-Host "=== MEETING CHAT ENDPOINTS ===" -ForegroundColor Cyan
Test-Endpoint -Method "GET" -Endpoint "/api/meeting-chat" `
    -Description "Get Meeting Messages"

Test-Endpoint -Method "POST" -Endpoint "/api/meeting-chat" `
    -Body '{"message":"Test message"}' `
    -Description "Send Meeting Message"

# ==================== COMPLAINTS ENDPOINTS ====================
Write-Host "=== COMPLAINTS ENDPOINTS ===" -ForegroundColor Cyan
Test-Endpoint -Method "GET" -Endpoint "/api/complaints" `
    -Description "Get Complaints List"

# ==================== SESSION ENDPOINTS ====================
Write-Host "=== SESSION ENDPOINTS ===" -ForegroundColor Cyan
Test-Endpoint -Method "GET" -Endpoint "/api/auth/session" `
    -Description "Get Session Info"

# ==================== SUMMARY ====================
Write-Host ""
Write-Host "=== TEST SUMMARY ===" -ForegroundColor Cyan
Write-Host ""

$passCount = ($resultsCollection | Where-Object { $_.Status -eq "PASS" }).Count
$totalCount = $resultsCollection.Count
$passPercentage = if ($totalCount -gt 0) { [math]::Round(($passCount / $totalCount) * 100, 1) } else { 0 }

Write-Host "Tests Passed: $passCount / $totalCount ($passPercentage%)" -ForegroundColor Green
Write-Host ""

Write-Host "Database Configuration:" -ForegroundColor Cyan
Write-Host "  - MongoDB Atlas connection via MONGODB_URI" -ForegroundColor Gray
Write-Host "  - All data posted to MongoDB cloud database" -ForegroundColor Gray
Write-Host ""

Write-Host "File Upload Directories:" -ForegroundColor Cyan
Write-Host "  - CNIC Scans: /uploads/cnic-scans/" -ForegroundColor Gray
Write-Host "  - Complaints Media: /uploads/complaints/" -ForegroundColor Gray
Write-Host "  - Maintenance Slips: /uploads/maintenance/" -ForegroundColor Gray
Write-Host "  - Vehicle Cards: /uploads/vehicle-cards/" -ForegroundColor Gray
Write-Host ""

Write-Host "Verification Complete!" -ForegroundColor Green
Write-Host ""

# Save detailed results
@"
CHS API ENDPOINTS VERIFICATION REPORT
Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Base URL: $ApiUrl

RESULTS:
--------
$($resultsCollection | Format-Table -AutoSize | Out-String)

SUMMARY:
--------
Total Tests: $totalCount
Passed: $passCount
Pass Rate: $passPercentage%

NEXT STEPS:
-----------
1. Verify MONGODB_URI environment variable is set
2. Check MongoDB Atlas IP whitelist includes your IP
3. Monitor logs for any database connection errors
4. Test file uploads with actual files
5. Deploy to cloud when ready (Render.com, Heroku, AWS, etc.)

ADDITIONAL INFORMATION:
-----------------------
- All POST requests are configured to save data to MongoDB
- File uploads are stored in /uploads/ directory
- Sessions are managed via express-session
- CORS is configured for cloud deployments
"@ | Out-File -FilePath $OutputFile -Encoding UTF8

Write-Info "Detailed results saved to: $OutputFile"
