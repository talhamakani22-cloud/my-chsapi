# Complete Form Request Bodies - All Forms

> **📝 Update (2026-07-09):** All image upload endpoints now support **JSON with Base64 encoding** in addition to traditional FormData file uploads. This provides better portability and easier integration with mobile apps. Both formats are fully supported.

## 1. Visitor Form
**Endpoint:** POST /api/visitors
**Content-Type:** `application/json` (recommended) or `multipart/form-data`
**Supports:** Both JSON with base64 encoding AND FormData file uploads

### Full Request Body (JSON with Base64 Image)

This is the complete request body example for the visitor form and can be sent as-is.
```json
{
  "emiratesId": "12345-1234567-1",
  "fullNameEnglish": "Amjad Ali",
  "fatherName": "Ali Mohammed",
  "fullNameArabic": "أحمد علي",
  "nationality": "Pakistan",
  "countryOfStay": "Pakistan",
  "houseNumber": "Block A, House 101",
  "entryTime": "2026-07-09T10:30:00",
  "dateOfBirth": "1990-01-15",
  "gender": "Male",
  "issueDate": "2020-01-01",
  "expiryDate": "2030-01-01",
  "purposeOfVisit": "Business Meeting",
  "remark": "Monthly visit",
  "platform": "expo",
  "cnicImageBase64": "iVBORw0KGgoAAAANS... (base64 encoded JPG/PNG image - optional)",
  "cnicImageName": "cnic.jpg",
  "cnicImageMimeType": "image/jpeg"
}
```

### Response (Success)
```json
{
  "success": true,
  "message": "Visitor added successfully",
  "visitor": {
    "_id": "507f1f77bcf86cd799439011",
    "emiratesId": "12345-1234567-1",
    "fullNameEnglish": "Ahmed Ali",
    "fatherName": "Ali Mohammed",
    "nationality": "Pakistan",
    "countryOfStay": "Pakistan",
    "houseNumber": "Block A, House 101",
    "entryTime": "2026-07-09T10:30:00",
    "dateOfBirth": "1990-01-15",
    "gender": "Male",
    "issueDate": "2020-01-01",
    "expiryDate": "2030-01-01",
    "purposeOfVisit": "Business Meeting",
    "remark": "Monthly visit",
    "scannedImageUri": "/uploads/cnic-scans/cnic-1234567890-987654321.jpg",
    "platform": "expo",
    "createdAt": "2026-07-09T10:30:00.000Z"
  }
}
```

---

## 2. Family Form - Upload CNIC Image
**Endpoint:** POST /api/family/upload-cnic-image
**Content-Type:** `application/json` (recommended) or `multipart/form-data`
**Supports:** Both JSON with base64 encoding AND FormData file uploads

### Request Body (JSON with Base64 Image)
```json
{
  "residentName": "John Resident",
  "flatNumber": "101",
  "familyMembers": [
    {
      "name": "Jane Resident",
      "relation": "Spouse",
      "cnic": "12345-6789012-3"
    },
    {
      "name": "Ahmed Resident",
      "relation": "Son",
      "cnic": "98765-4321098-7"
    },
    {
      "name": "Fatima Resident",
      "relation": "Daughter",
      "cnic": "11111-2222222-3"
    }
  ],
  "cnicImageBase64": "iVBORw0KGgoAAAANS... (base64 encoded JPG/PNG image)",
  "cnicImageName": "family-cnic.jpg",
  "cnicImageMimeType": "image/jpeg"
}
```

### Response (Success)
```json
{
  "success": true,
  "message": "CNIC Image uploaded successfully.",
  "upload": {
    "id": "507f1f77bcf86cd799439012",
    "residentName": "John Resident",
    "flatNumber": "101",
    "familyMembers": [
      {
        "name": "Jane Resident",
        "relation": "Spouse",
        "cnic": "12345-6789012-3"
      }
    ],
    "fileName": "family-cnic.jpg",
    "storedFileName": "1720590600000-family-cnic.jpg",
    "mimeType": "image/jpeg",
    "size": 245632,
    "filePath": "/uploads/cnic-images/1720590600000-family-cnic.jpg",
    "uploadedAt": "2026-07-09T10:30:00.000Z"
  }
}
```

---

## 3. Vehicle Form - Upload Card Image
**Endpoint:** POST /api/vehicle/upload-card-image
**Content-Type:** `application/json` (recommended) or `multipart/form-data`
**Supports:** Both JSON with base64 encoding AND FormData file uploads

### Request Body (JSON with Base64 Image)
```json
{
  "ownerCnic": "12345-6789012-3",
  "flatNumber": "101",
  "vehicleType": "Car",
  "vehicleNumber": "ABC-123",
  "address": "House #101, Block A, Street Name",
  "registrationDate": "2023-01-15",
  "cardImageBase64": "iVBORw0KGgoAAAANS... (base64 encoded JPG/PNG image)",
  "cardImageName": "vehicle-card.jpg",
  "cardImageMimeType": "image/jpeg"
}
```

### Response (Success)
```json
{
  "success": true,
  "message": "Vehicle registration saved successfully.",
  "record": {
    "_id": "507f1f77bcf86cd799439013",
    "ownerCnic": "12345-6789012-3",
    "flatNumber": "101",
    "vehicleType": "Car",
    "vehicleNumber": "ABC-123",
    "address": "House #101, Block A, Street Name",
    "registrationDate": "2023-01-15",
    "cardUri": "/uploads/vehicle-cards/vehicle-1234567890-987654321.jpg",
    "uploadedAt": "2026-07-09T10:30:00.000Z"
  }
}
```

---

## 4. Complaint Form
**Endpoint:** POST /api/complaints
**Content-Type:** `application/json` (recommended) or `multipart/form-data`
**Supports:** Both JSON with base64 encoding AND FormData file uploads

### Request Body (JSON with Base64 Image/Video)
```json
{
  "description": "Water leakage in bathroom",
  "complaintType": "Maintenance",
  "complaintMediaBase64": "iVBORw0KGgoAAAANS... (base64 encoded image/video file)",
  "complaintMediaName": "complaint-photo.jpg",
  "complaintMediaMimeType": "image/jpeg"
}
```

### Response (Success)
```json
{
  "success": true,
  "row": {
    "id": "507f1f77bcf86cd799439014",
    "ticketNo": "CMP-1720590600000",
    "complaintType": "Maintenance",
    "description": "Water leakage in bathroom",
    "mediaUri": "/uploads/complaints/complaint-1234567890.jpg",
    "mediaAvailable": true,
    "mediaMimeType": "image/jpeg",
    "mediaKind": "image",
    "flatNumber": "101",
    "status": "Open",
    "statusNote": "Complaint received",
    "sender": {
      "email": "user@chs.com",
      "role": "resident",
      "loginType": "resident"
    },
    "createdAt": "2026-07-09T10:30:00.000Z"
  }
}
```

---

## 5. Notification Form
**Endpoint:** POST /api/notifications

### Request Body (JSON)
```json
{
  "title": "Monthly Maintenance Due",
  "message": "Please pay your maintenance fee for July 2026 by 15th July",
  "target": "both"
}
```

### Response (Success)
```json
{
  "success": true,
  "message": "Notification created successfully.",
  "_id": "507f1f77bcf86cd799439015",
  "title": "Monthly Maintenance Due",
  "message": "Please pay your maintenance fee for July 2026 by 15th July",
  "target": "both",
  "createdAt": "2026-07-09T10:30:00.000Z"
}
```

---

## 6. Meeting Chat Form
**Endpoint:** POST /api/meeting-chat

### Request Body (JSON)
```json
{
  "message": "I have a question about the maintenance charges"
}
```

### Response (Success)
```json
{
  "success": true,
  "message": "Message sent successfully.",
  "_id": "507f1f77bcf86cd799439016",
  "message": "I have a question about the maintenance charges",
  "sender": {
    "email": "user@chs.com",
    "role": "resident"
  },
  "createdAt": "2026-07-09T10:30:00.000Z"
}
```

---

## 7. Maintenance Receipt Form
**Endpoint:** POST /api/maintenance/broadcast
**Note:** For uploading receipt images/slips, use endpoint #8

### Request Body (JSON)
```json
{
  "receiptNo": "RCP-2026-07-001",
  "ownerName": "Ahmed Properties",
  "residentName": "John Resident",
  "flatNumber": "101",
  "receiptMonth": "July",
  "amount": 500,
  "status": "paid",
  "paymentDate": "2026-07-09",
  "note": "Payment received successfully",
  "generatedAt": "2026-07-09T10:30:00",
  "receiptImageUri": "file:///path/to/receipt.jpg"
}
```

### Response (Success)
```json
{
  "success": true,
  "message": "Maintenance receipt generated and sent to 45 users",
  "recipientsCount": 45,
  "receiptNo": "RCP-2026-07-001",
  "createdAt": "2026-07-09T10:30:00.000Z"
}
```

---

## 8. Maintenance Payment Slip Upload
**Endpoint:** POST /api/maintenance/upload-slip
**Content-Type:** `application/json` (recommended) or `multipart/form-data`
**Supports:** Both JSON with base64 encoding AND FormData file uploads

### Request Body (JSON with Base64 Image)
```json
{
  "receiptNo": "RCP-2026-07-001",
  "slipImageBase64": "iVBORw0KGgoAAAANS... (base64 encoded JPG/PNG image)",
  "slipImageName": "payment-slip.jpg",
  "slipImageMimeType": "image/jpeg"
}
```

### Response (Success)
```json
{
  "success": true,
  "message": "Slip uploaded successfully. Your status is now paid.",
  "overallStatus": "paid",
  "record": {
    "_id": "507f1f77bcf86cd799439017",
    "receiptNo": "RCP-2026-07-001",
    "slipImageUri": "/uploads/maintenance/slip-1234567890.jpg",
    "status": "paid",
    "uploadedAt": "2026-07-09T10:30:00.000Z"
  }
}
```

---

## 9. Bulk Maintenance Broadcast
**Endpoint:** POST /api/maintenance/broadcast-bulk

### Request Body (JSON)
```json
{
  "receipts": [
    {
      "receiptNo": "RCP-2026-07-001",
      "ownerName": "Ahmed Properties",
      "residentName": "John Resident",
      "flatNumber": "101",
      "receiptMonth": "July",
      "amount": 500,
      "status": "paid",
      "paymentDate": "2026-07-09",
      "note": "Payment received",
      "generatedAt": "2026-07-09T10:30:00",
      "receiptImageUri": "file:///path/to/receipt.jpg"
    },
    {
      "receiptNo": "RCP-2026-07-002",
      "ownerName": "Ahmed Properties",
      "residentName": "Jane Smith",
      "flatNumber": "102",
      "receiptMonth": "July",
      "amount": 500,
      "status": "pending",
      "paymentDate": "2026-07-15",
      "note": "Pending payment",
      "generatedAt": "2026-07-09T10:30:00",
      "receiptImageUri": "file:///path/to/receipt2.jpg"
    }
  ]
}
```

### Response (Success)
```json
{
  "success": true,
  "message": "2 receipts processed and sent to 45 users",
  "processed": 2,
  "recipientsCount": 45
}
```

---

## 10. Update Complaint Status
**Endpoint:** PUT /api/complaints/{complaintId}/status

### Request Body (JSON)
```json
{
  "status": "resolved",
  "statusNote": "Issue has been fixed. Water leakage repaired and tested."
}
```

### Response (Success)
```json
{
  "success": true,
  "message": "Complaint status updated successfully.",
  "row": {
    "_id": "507f1f77bcf86cd799439014",
    "ticketNo": "CMP-1720590600000",
    "status": "resolved",
    "statusNote": "Issue has been fixed. Water leakage repaired and tested.",
    "updatedAt": "2026-07-09T11:00:00.000Z"
  }
}
```

---

## 11. Update Notification
**Endpoint:** PUT /api/notifications/{notificationId}

### Request Body (JSON)
```json
{
  "title": "Updated: Maintenance Due Date Extended",
  "message": "Payment deadline extended to 25th July 2026",
  "target": "resident"
}
```

### Response (Success)
```json
{
  "success": true,
  "message": "Notification updated successfully.",
  "_id": "507f1f77bcf86cd799439015",
  "title": "Updated: Maintenance Due Date Extended",
  "message": "Payment deadline extended to 25th July 2026",
  "target": "resident",
  "updatedAt": "2026-07-09T11:00:00.000Z"
}
```

---

## 12. Update Profile
**Endpoint:** PUT /api/auth/profile

### Request Body (JSON)
```json
{
  "displayName": "John Resident",
  "residentName": "John Resident",
  "flatNumber": "101",
  "familyMembers": [
    {
      "name": "Jane Resident",
      "relation": "Spouse",
      "cnic": "12345-6789012-3"
    }
  ],
  "familyRecordId": "507f1f77bcf86cd799439012",
  "vehicleDetails": [
    {
      "vehicleNumber": "ABC-123",
      "vehicleType": "Car",
      "registrationDate": "2023-01-01"
    }
  ]
}
```

### Response (Success)
```json
{
  "success": true,
  "message": "Profile updated successfully.",
  "profile": {
    "_id": "507f1f77bcf86cd799439000",
    "displayName": "John Resident",
    "email": "john@chs.com",
    "flatNumber": "101",
    "familyMembers": [...],
    "vehicleDetails": [...],
    "updatedAt": "2026-07-09T11:00:00.000Z"
  }
}
```

---

## Field Validation Rules

### Required Fields by Form

#### Visitor Form
- ✅ emiratesId (format: 12345-1234567-1)
- ✅ fullNameEnglish
- ✅ fatherName
- ✅ countryOfStay
- ✅ houseNumber
- ✅ entryTime (ISO 8601 format)
- ✅ dateOfBirth (YYYY-MM-DD)
- ✅ gender (Male/Female/Other)
- ✅ issueDate (YYYY-MM-DD)
- ✅ expiryDate (YYYY-MM-DD)
- ✅ purposeOfVisit
- ✅ remark
- ⚠️ cnicImageBase64 (optional - JSON format) OR cnicPdf file (FormData format)

#### Family Form
- ✅ residentName
- ✅ flatNumber
- ✅ familyMembers (array)
- ⚠️ cnicImageBase64 (optional - JSON format) OR cnicImage file (FormData format)

#### Vehicle Form
- ✅ ownerCnic
- ✅ flatNumber
- ✅ vehicleType
- ✅ vehicleNumber
- ✅ address
- ✅ registrationDate
- ⚠️ cardImageBase64 (optional - JSON format) OR cardImage file (FormData format)

#### Complaint Form
- ✅ description
- ⚠️ complaintType (optional)
- ⚠️ complaintMediaBase64 (optional - JSON format) OR complaintMedia file (FormData format)

#### Notification Form
- ✅ title
- ✅ message
- ✅ target (both/resident/reception)

#### Maintenance Slip
- ✅ receiptNo or receiptId
- ⚠️ slipImageBase64 (optional - JSON format) OR slipPdf file (FormData format)

---

## Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid CNIC format" | Wrong emiratesId format | Use 12345-1234567-1 (5-7-1 digits) |
| "All fields are required" | Missing required field | Check all required fields are sent |
| "Only image files allowed" | Wrong file type | Use JPG or PNG only |
| "File too large" | File exceeds size limit | Reduce file size (max 30MB) |
| "Database connection not ready" | MongoDB not connected | Check MONGODB_URI environment variable |

---

## Tips for Testing

### In Postman

**Option 1: JSON with Base64 (Recommended for image uploads)**

1. **For Image Upload requests** (Visitor, Family, Vehicle, Complaint, Maintenance Slip):
   - Set request to **POST**
   - Go to **Body** tab
   - Select **raw**
   - Select **JSON** from dropdown
   - Encode your image to Base64 and paste in the appropriate `ImageBase64` field
   - Example fields: `cnicImageBase64`, `cardImageBase64`, `complaintMediaBase64`, `slipImageBase64`

2. **For Non-Image requests** (Notifications, Profile, Maintenance, Meeting Chat):
   - Set request to **POST**
   - Go to **Body** tab
   - Select **raw**
   - Select **JSON** from dropdown
   - Paste JSON body

**Option 2: FormData with File Upload (Also Supported)**

1. **For Image Upload requests** (Visitor, Family, Vehicle, Complaint, Maintenance Slip):
   - Set request to **POST**
   - Go to **Body** tab
   - Select **form-data**
   - Add form fields as key-value pairs
   - For image file fields, select **File** type from dropdown
   - Supported file types: JPG, PNG for all image uploads

### How to Convert Image to Base64

**PowerShell:**
```powershell
[Convert]::ToBase64String([System.IO.File]::ReadAllBytes("C:\path\to\image.jpg"))
```

**Bash:**
```bash
cat /path/to/image.jpg | base64 -w 0
```

**Online Tool:**
- Visit https://www.base64encode.org/
- Upload your image and copy the base64 string

### With cURL
```bash
# JSON request with Base64 Image (Visitor)
curl -X POST https://my-chsapi.onrender.com/api/visitors \
  -H "Content-Type: application/json" \
  -d '{
    "emiratesId": "12345-1234567-1",
    "fullNameEnglish": "Ahmed Ali",
    "fatherName": "Ali Mohammed",
    "countryOfStay": "Pakistan",
    "houseNumber": "101",
    "entryTime": "2026-07-09T10:30:00",
    "dateOfBirth": "1990-01-15",
    "gender": "Male",
    "issueDate": "2020-01-01",
    "expiryDate": "2030-01-01",
    "purposeOfVisit": "Business Meeting",
    "remark": "Test",
    "platform": "expo",
    "cnicImageBase64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "cnicImageName": "cnic.jpg",
    "cnicImageMimeType": "image/jpeg"
  }'

# FormData request with file upload (Vehicle)
curl -X POST https://my-chsapi.onrender.com/api/vehicle/upload-card-image \
  -F "ownerCnic=12345-6789012-3" \
  -F "flatNumber=101" \
  -F "vehicleType=Car" \
  -F "vehicleNumber=ABC-123" \
  -F "address=House #101" \
  -F "registrationDate=2023-01-15" \
  -F "cardImage=@/path/to/vehicle-card.jpg"

# JSON request (Notification)
curl -X POST https://my-chsapi.onrender.com/api/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test",
    "message": "Test message",
    "target": "both"
  }'
```
