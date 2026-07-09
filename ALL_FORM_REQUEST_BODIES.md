# All Forms Request Body (JSON Only)

Updated: 2026-07-09

All examples below are JSON request bodies.

## 1) Login Form
Endpoint: POST /api/auth/login

{
  "email": "resident123@chs.com",
  "password": "password123",
  "loginType": "resident"
}

## 2) Signup Form
Endpoint: POST /api/auth/signup

{
  "username": "resident_123",
  "email": "resident123@chs.com",
  "password": "password123",
  "signupMode": "resident-self",
  "committeeEmail": "committee@chs.com",
  "committeePassword": "committeePass"
}

## 3) Reset Password Form
Endpoint: POST /api/auth/reset-password

{
  "email": "resident123@chs.com",
  "loginType": "resident",
  "newPassword": "newpassword123",
  "confirmPassword": "newpassword123"
}

## 4) New Visitor Form
Endpoint: POST /api/visitors

{
  "cnicId": "12345-1234567-1",
  "fullNameEnglish": "Amjad Ali",
  "fatherName": "Ali Akbar",
  "nationality": "Pakistan",
  "countryOfStay": "Pakistan",
  "houseNumber": "Block A, House 101",
  "entryTime": "2026-07-09T10:30:00",
  "dateOfBirth": "1990-01-15",
  "gender": "Male",
  "issueDate": "2020-01-01",
  "expiryDate": "2030-01-01",
  "purposeOfVisit": "Meeting",
  "remark": "Checked In",
  "platform": "expo",
  "cnicImageBase64": "BASE64_IMAGE_DATA",
  "cnicImageName": "cnic.jpg",
  "cnicImageMimeType": "image/jpeg"
}

## 5) Family Details Form
Endpoint: PUT /api/auth/profile

{
  "displayName": "Resident Name",
  "residentName": "Resident Name",
  "flatNumber": "123",
  "familyMembers": [
    {
      "memberName": "Member One",
      "relation": "Son",
      "cnic": "12345-1234567-1",
      "phone": "03001234567"
    }
  ]
}

## 6) Vehicle Registration Form
Endpoint: PUT /api/auth/profile

{
  "displayName": "Owner Name",
  "flatNumber": "123",
  "vehicleDetails": [
    {
      "ownerName": "Owner Name",
      "ownerCnic": "12345-1234567-1",
      "flatNumber": "123",
      "vehicleType": "Car",
      "vehicleNumber": "ABC-123",
      "address": "Street 1",
      "registrationDate": "2026-07-09"
    }
  ]
}

## 7) Upload Document Form
Endpoint: POST /api/documents/upload

{
  "ownerName": "Resident Name",
  "flatNumber": "123",
  "documentPdfBase64": "BASE64_PDF_DATA",
  "documentPdfName": "security-documents.pdf",
  "documentPdfMimeType": "application/pdf"
}

## 8) Complaint Form
Endpoint: POST /api/complaints

{
  "description": "Water leakage in bathroom",
  "complaintType": "Maintenance",
  "complaintMediaBase64": "BASE64_IMAGE_OR_VIDEO_DATA",
  "complaintMediaName": "complaint-photo.jpg",
  "complaintMediaMimeType": "image/jpeg"
}

## 9) Complaint Status Update Form
Endpoint: PUT /api/complaints/:complaintId/status

{
  "status": "In Progress",
  "statusNote": "Technician assigned"
}

## 10) Notification Create Form
Endpoint: POST /api/notifications

{
  "title": "Maintenance Notice",
  "message": "Please pay before due date.",
  "target": "both"
}

## 11) Notification Update Form
Endpoint: PUT /api/notifications/:id

{
  "title": "Updated Title",
  "message": "Updated Message",
  "target": "resident"
}

## 12) Register Device Form
Endpoint: POST /api/notifications/register-device

{
  "expoPushToken": "ExponentPushToken[xxxx]",
  "platform": "ios"
}

## 13) Unregister Device Form
Endpoint: POST /api/notifications/unregister-device

{
  "expoPushToken": "ExponentPushToken[xxxx]"
}

## 14) Meeting Chat Form
Endpoint: POST /api/meeting-chat

{
  "message": "Hello committee"
}

## 15) Maintenance Receipt Generate Form
Endpoint: POST /api/maintenance/broadcast

{
  "receiptNo": "MR-1720000000000",
  "ownerName": "Resident Name",
  "residentName": "Resident Name",
  "flatNumber": "123",
  "receiptMonth": "July 2026",
  "amount": 1500,
  "status": "Unpaid",
  "paymentDate": "2026-07-10",
  "note": "Monthly maintenance",
  "generatedAt": "2026-07-09T10:00:00.000Z",
  "receiptPdfUri": "file:///path/to/receipt.pdf"
}

## 16) Maintenance Bulk Generate Form
Endpoint: POST /api/maintenance/broadcast-bulk

{
  "receiptMonth": "July 2026",
  "amount": 1500,
  "status": "Unpaid",
  "paymentDate": "2026-07-10",
  "note": "Monthly maintenance",
  "generatedAt": "2026-07-09T10:00:00.000Z"
}

## 17) Maintenance Slip Upload Form
Endpoint: POST /api/maintenance/upload-slip

{
  "receiptNo": "MR-1720000000000",
  "slipImageBase64": "BASE64_IMAGE_DATA",
  "slipImageName": "payment-slip.jpg",
  "slipImageMimeType": "image/jpeg"
}

## 18) Settings Save Form
Endpoint: PUT /api/auth/profile

{
  "displayName": "Resident Name",
  "residentName": "Resident Name",
  "flatNumber": "123",
  "familyMembers": [
    {
      "memberName": "Member One",
      "relation": "Daughter",
      "cnic": "12345-1234567-1",
      "phone": "03001234567"
    }
  ],
  "familyRecordId": "optional-record-id",
  "vehicleDetails": [
    {
      "id": "optional-vehicle-id",
      "ownerName": "Resident Name",
      "ownerCnic": "12345-1234567-1",
      "flatNumber": "123",
      "vehicleType": "Car",
      "vehicleNumber": "ABC-123",
      "address": "Street 1",
      "registrationDate": "2026-07-09"
    }
  ]
}

## 19) OCR Fallback Form
Endpoint: POST /api/ocr

{
  "imageBase64": "BASE64_IMAGE_DATA",
  "imageName": "ocr-image.jpg",
  "imageMimeType": "image/jpeg"
}

Note:
- The live /api/ocr endpoint currently expects file field image (multipart), while this section provides a JSON representation style for documentation consistency.
