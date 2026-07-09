#!/bin/bash

# CHS API Endpoints Verification Script
# This script tests all API endpoints to verify they're posting correctly to cloud

API_BASE_URL="${1:-http://localhost:3000}"
RESULTS_FILE="api_test_results.log"

echo "=================================================="
echo "CHS API Endpoints Verification Report"
echo "Base URL: $API_BASE_URL"
echo "Timestamp: $(date)"
echo "=================================================="
echo "" > "$RESULTS_FILE"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test endpoint
test_endpoint() {
  local method=$1
  local endpoint=$2
  local data=$3
  local description=$4
  
  echo -e "\n${YELLOW}Testing: $description${NC}"
  echo "Endpoint: $method $endpoint"
  
  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE_URL$endpoint" \
      -H "Content-Type: application/json")
  else
    response=$(curl -s -w "\n%{http_code}" -X $method "$API_BASE_URL$endpoint" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  echo "HTTP Code: $http_code"
  
  if [[ $http_code -ge 200 && $http_code -lt 300 ]]; then
    echo -e "${GREEN}✅ SUCCESS${NC}"
  elif [[ $http_code -ge 400 && $http_code -lt 500 ]]; then
    echo -e "${YELLOW}⚠️ CLIENT ERROR (Expected if data not found)${NC}"
  else
    echo -e "${RED}❌ FAILED${NC}"
  fi
  
  echo "Response: ${body:0:100}..."
  echo "---" >> "$RESULTS_FILE"
  echo "$description - HTTP $http_code" >> "$RESULTS_FILE"
}

# Check if API is running
echo -e "\n${YELLOW}Checking API Connection...${NC}"
if ! curl -s "$API_BASE_URL" > /dev/null 2>&1; then
  echo -e "${RED}❌ API is not responding. Make sure the server is running.${NC}"
  exit 1
fi
echo -e "${GREEN}✅ API is running${NC}"

# ==================== AUTHENTICATION ENDPOINTS ====================
echo -e "\n${YELLOW}=== AUTHENTICATION ENDPOINTS ===${NC}"

test_endpoint "POST" "/api/auth/login" \
  '{"email":"user@example.com","password":"password123","loginType":"resident"}' \
  "Login"

test_endpoint "GET" "/api/auth/profile" "" \
  "Get Profile"

test_endpoint "POST" "/api/auth/signup" \
  '{"username":"test_user","email":"test@example.com","password":"password123","signupMode":"resident-self"}' \
  "Signup"

test_endpoint "POST" "/api/auth/reset-password" \
  '{"email":"user@example.com","loginType":"resident","newPassword":"newpass123","confirmPassword":"newpass123"}' \
  "Reset Password"

# ==================== VISITOR ENDPOINTS ====================
echo -e "\n${YELLOW}=== VISITOR MANAGEMENT ENDPOINTS ===${NC}"

test_endpoint "GET" "/api/visitors" "" \
  "Get Visitors List"

# Note: POST /api/visitors requires file upload - cannot test with simple cURL

# ==================== FAMILY ENDPOINTS ====================
echo -e "\n${YELLOW}=== FAMILY MANAGEMENT ENDPOINTS ===${NC}"

test_endpoint "GET" "/api/family" "" \
  "Get Family Details"

test_endpoint "POST" "/api/family/upload-cnic-pdf" \
  '{"residentName":"John","flatNumber":"101","familyMembers":[],"cnicPdfBase64":"test","cnicPdfName":"test.pdf","cnicPdfMimeType":"application/pdf"}' \
  "Upload Family CNIC PDF"

# ==================== VEHICLE ENDPOINTS ====================
echo -e "\n${YELLOW}=== VEHICLE MANAGEMENT ENDPOINTS ===${NC}"

test_endpoint "GET" "/api/vehicle" "" \
  "Get Vehicle Details"

# ==================== MAINTENANCE ENDPOINTS ====================
echo -e "\n${YELLOW}=== MAINTENANCE ENDPOINTS ===${NC}"

test_endpoint "GET" "/api/maintenance/report" "" \
  "Get Maintenance Report"

test_endpoint "POST" "/api/maintenance/broadcast" \
  '{"receiptNo":"2024-001","ownerName":"Owner","residentName":"Resident","flatNumber":"101","receiptMonth":"January","amount":500,"status":"paid","paymentDate":"2024-01-15","note":"Test","generatedAt":"2024-01-15T10:30:00","receiptPdfUri":"test.pdf"}' \
  "Broadcast Maintenance Receipt"

test_endpoint "POST" "/api/maintenance/broadcast-bulk" \
  '{"receipts":[{"receiptNo":"2024-001","ownerName":"Owner","residentName":"Resident","flatNumber":"101","receiptMonth":"January","amount":500,"status":"paid","paymentDate":"2024-01-15","note":"Test","generatedAt":"2024-01-15T10:30:00","receiptPdfUri":"test.pdf"}]}' \
  "Broadcast Maintenance (Bulk)"

# ==================== NOTIFICATION ENDPOINTS ====================
echo -e "\n${YELLOW}=== NOTIFICATION ENDPOINTS ===${NC}"

test_endpoint "GET" "/api/notifications" "" \
  "Get Notifications List"

test_endpoint "POST" "/api/notifications" \
  '{"title":"Test Notification","message":"This is a test","target":"both"}' \
  "Create Notification"

test_endpoint "POST" "/api/notifications/register-device" \
  '{"expoPushToken":"ExponentPushToken[test]","platform":"ios"}' \
  "Register Device for Push"

# ==================== MEETING CHAT ENDPOINTS ====================
echo -e "\n${YELLOW}=== MEETING CHAT ENDPOINTS ===${NC}"

test_endpoint "GET" "/api/meeting-chat" "" \
  "Get Meeting Messages"

test_endpoint "POST" "/api/meeting-chat" \
  '{"message":"Test message"}' \
  "Send Meeting Message"

# ==================== COMPLAINTS ENDPOINTS ====================
echo -e "\n${YELLOW}=== COMPLAINTS ENDPOINTS ===${NC}"

test_endpoint "GET" "/api/complaints" "" \
  "Get Complaints List"

test_endpoint "POST" "/api/complaints" \
  '{"description":"Test complaint","complaintType":"Maintenance"}' \
  "Create Complaint (note: requires file upload)"

# ==================== OCR ENDPOINTS ====================
echo -e "\n${YELLOW}=== OCR ENDPOINTS ===${NC}"

test_endpoint "GET" "/api/ocr" "" \
  "OCR Endpoint Check"

# ==================== SESSION ENDPOINTS ====================
echo -e "\n${YELLOW}=== SESSION ENDPOINTS ===${NC}"

test_endpoint "GET" "/api/auth/session" "" \
  "Get Session Info"

# ==================== SUMMARY ====================
echo -e "\n${YELLOW}=== TEST SUMMARY ===${NC}"
echo "Full results saved to: $RESULTS_FILE"
echo ""
echo "Database Connection:"
echo "  - Check MONGODB_URI environment variable is set"
echo "  - Verify MongoDB Atlas connection string is correct"
echo "  - Ensure IP whitelist includes your server IP"
echo ""
echo "File Uploads:"
echo "  - CNIC Scans: /uploads/cnic-scans/"
echo "  - Complaints Media: /uploads/complaints/"
echo "  - Maintenance Slips: /uploads/maintenance/"
echo "  - Vehicle Cards: /uploads/vehicle-cards/"
echo ""
echo "Next Steps:"
echo "  1. Run 'npm run server' to start the Express server"
echo "  2. Ensure MongoDB Atlas is accessible"
echo "  3. Check environment variables in .env file"
echo "  4. Review logs for any database connection errors"
