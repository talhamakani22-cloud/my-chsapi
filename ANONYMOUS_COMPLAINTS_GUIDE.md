# Anonymous Complaint System - Complete Guide

## Overview

The **Anonymous Complaint System** allows residents and visitors to register complaints through a QR code without requiring any login or authentication. This enables:

- ✅ Complaints without sign-in
- ✅ Ticket-based tracking
- ✅ Email verification for status updates
- ✅ Flat owner name auto-population
- ✅ Image/video support
- ✅ Public status checking

---

## Architecture

### Backend Endpoints

#### 1. POST `/api/anonymous-complaints`
**Submit Anonymous Complaint**

```http
POST /api/anonymous-complaints
Content-Type: multipart/form-data

Params:
- flatNumber (required): Flat number (e.g., "101", "A-201")
- complaintType (required): Type of complaint
- description (required): Detailed complaint description
- email (required): Email for tracking
- phone (required): Phone number for contact
- complaintMedia (optional): Image or video file (JPG, PNG, MP4, MOV)
```

**Response:**
```json
{
  "success": true,
  "message": "Complaint registered successfully",
  "ticket": {
    "ticketNo": "ANON-1720590600000-ABC123XYZ",
    "flatNumber": "101",
    "ownerName": "John Resident",
    "complaintType": "Maintenance",
    "status": "Open",
    "createdAt": "2026-07-09T10:30:00.000Z",
    "emailVerificationSent": true
  }
}
```

#### 2. GET `/api/anonymous-complaints/:ticketNo/status?token={verificationToken}`
**Check Complaint Status**

```http
GET /api/anonymous-complaints/ANON-1720590600000-ABC123XYZ/status?token=abc123def456...
```

**Response:**
```json
{
  "success": true,
  "complaint": {
    "ticketNo": "ANON-1720590600000-ABC123XYZ",
    "flatNumber": "101",
    "ownerName": "John Resident",
    "complaintType": "Maintenance",
    "description": "Water leakage in bathroom",
    "status": "Open",
    "statusNote": "Complaint received - Pending review",
    "createdAt": "2026-07-09T10:30:00.000Z",
    "updatedAt": "2026-07-09T10:30:00.000Z",
    "mediaAvailable": true,
    "mediaKind": "image"
  }
}
```

---

## Frontend Implementation

### Accessing Anonymous Complaint Form

#### Option 1: Via QR Code (Recommended)
1. Scan QR code with phone camera
2. Opens app automatically to complaint form
3. App pre-populates flat number (if QR includes it)

#### Option 2: Direct URL
```
https://my-chsapi.onrender.com/anonymous-complaints
https://my-chsapi.onrender.com/anonymous-complaints?flat=101
https://my-chsapi.onrender.com/anonymous-complaints?type=Maintenance
```

#### Option 3: Deep Link (Expo/Mobile)
```
exp://my-chsapi.onrender.com/anonymous-complaints
exp://my-chsapi.onrender.com/anonymous-complaints?flat=101
```

### Form Flow

1. **Flat Number Input**
   - User enters flat number
   - System auto-fetches owner name from database
   - Shows "Flat owner: [Name]"

2. **Complaint Type Selection**
   - Maintenance
   - Noise
   - Cleanliness
   - Parking
   - Other

3. **Description Input**
   - Multi-line text describing the issue

4. **Contact Information**
   - Email (for status updates)
   - Phone (for follow-up)

5. **Media Upload**
   - Image (JPG, PNG - auto-compressed to 0.5MB)
   - Video (MP4, MOV)
   - Optional but recommended

6. **Submission**
   - System generates ticket number
   - Sends verification email
   - Shows success page with ticket

### Success Page Display

After submission, user sees:
```
✓ Complaint Registered Successfully

Ticket Number: ANON-1720590600000-ABC123XYZ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Flat Number: 101
Owner Name: John Resident
Complaint Type: Maintenance
Status: Open
Registered: 07/09/2026

📧 Email Confirmation
A verification link has been sent to your email. 
You can check your complaint status anytime using this link.

[Register Another Complaint]
```

### Status Checking Page

Without login, users can check status via:
1. **Email Link** - Sent after registration
2. **Manual Lookup** - Enter ticket number + email

---

## QR Code Generation

### Using QR Code Generator Utility

```javascript
const QRCodeGenerator = require('./utils/qrCodeGenerator');

// Generate standard complaint form QR code
await QRCodeGenerator.generateAnonymousComplaintQR(
  'https://my-chsapi.onrender.com',
  './qr-codes'
);

// Generate QR for specific flat
await QRCodeGenerator.generateCustomQR({
  flatNumber: '101',
  complaintType: 'Maintenance',
  appUrl: 'https://my-chsapi.onrender.com',
  outputPath: './qr-codes'
});

// Generate QR as data URL (for embedding)
const dataUrl = await QRCodeGenerator.generateQRDataUrl(
  'https://my-chsapi.onrender.com'
);

// Batch generate for multiple flats
const results = await QRCodeGenerator.generateBatchQRCodes(
  ['101', '102', '201', '202', '301', '302'],
  'https://my-chsapi.onrender.com',
  './qr-codes'
);
```

### Batch Generation Script

```javascript
// scripts/generate-complaint-qrs.js
const QRCodeGenerator = require('../utils/qrCodeGenerator');

(async () => {
  try {
    // Get all flat numbers from database
    const flats = ['101', '102', '201', '202'];
    
    const results = await QRCodeGenerator.generateBatchQRCodes(
      flats,
      process.env.APP_URL || 'https://my-chsapi.onrender.com'
    );

    console.log('Generated QR codes:', results);
  } catch (err) {
    console.error('Error:', err);
  }
})();
```

Run with:
```bash
node scripts/generate-complaint-qrs.js
```

---

## Email Notification

When complaint is registered, user receives:

**Subject:** Complaint Registered - Ticket #ANON-1720590600000-ABC123XYZ

**Content:**
```
Complaint Registered Successfully

Your complaint has been registered with the following details:

• Ticket Number: ANON-1720590600000-ABC123XYZ
• Flat Number: 101
• Complaint Type: Maintenance
• Status: Open
• Registered At: 07/09/2026 10:30 AM

Track Your Complaint Status:
[Click Here to Check Status]

Or copy this link: 
https://my-chsapi.onrender.com/complaint-status/abc123def456...

Keep your ticket number (ANON-1720590600000-ABC123XYZ) for future reference.
```

---

## Ticket Status Tracking

### Status Values
- **Open** - 🔴 Complaint received, pending review
- **In Progress** - 🟡 Being investigated/resolved
- **Resolved** - 🟢 Issue has been fixed
- **Closed** - ⚪ Complete, no further action needed

### Status Update (Admin)

```http
PUT /api/complaints/:complaintId/status
Content-Type: application/json

{
  "status": "in-progress",
  "statusNote": "Team investigating water leakage"
}
```

---

## Implementation Checklist

### Backend ✅
- [x] Anonymous complaint API endpoint
- [x] Email configuration
- [x] Ticket generation
- [x] Status checking endpoint
- [x] Flat owner name lookup
- [x] Media upload handling

### Frontend ✅
- [x] Anonymous complaint form page
- [x] Complaint status check page
- [x] Image compression (0.5MB limit)
- [x] Success page with ticket display
- [x] Error handling

### Utilities ✅
- [x] QR code generator
- [x] Batch QR generation
- [x] Email notifications

### Environment Variables Required
```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_SERVICE=gmail
APP_URL=https://my-chsapi.onrender.com
MONGODB_URI=mongodb+srv://...
```

---

## Usage Examples

### Test with cURL

```bash
# 1. Submit complaint
curl -X POST http://localhost:3000/api/anonymous-complaints \
  -F "flatNumber=101" \
  -F "complaintType=Maintenance" \
  -F "description=Water leaking from ceiling" \
  -F "email=user@example.com" \
  -F "phone=+971-50-1234567" \
  -F "complaintMedia=@/path/to/image.jpg"

# 2. Check status
curl -X GET "http://localhost:3000/api/anonymous-complaints/ANON-1720590600000-ABC123XYZ/status?token=abc123def456..."
```

### Test with Postman

1. **Create Anonymous Complaint**
   - Method: POST
   - URL: `{{api_url}}/api/anonymous-complaints`
   - Body: form-data
   - Fields:
     - flatNumber: `101`
     - complaintType: `Maintenance`
     - description: `Water leaking`
     - email: `user@example.com`
     - phone: `+971-50-1234567`
     - complaintMedia: (select image file)

2. **Check Status**
   - Method: GET
   - URL: `{{api_url}}/api/anonymous-complaints/ANON-xxx/status?token=xxx`

---

## Troubleshooting

### Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "Flat number not found" | Flat doesn't exist in family database | Ensure flat is registered in family collection |
| Email not received | Email credentials incorrect | Check EMAIL_USER and EMAIL_PASSWORD env vars |
| Status link expired | Token older than 7 days | Regenerate QR code or resend email |
| Image upload fails | File too large | Compression should keep under 0.5MB |
| Cannot access from QR | Deep link not configured | Ensure app routing is set up for `anonymous-complaints` |

---

## Security Considerations

1. **No Authentication** - Public access intentional for anonymous complaints
2. **Verification Token** - 7-day expiry on status links
3. **Email Verification** - Prevents abuse via spam tokens
4. **Rate Limiting** - Consider adding rate limits in production
5. **Input Validation** - All fields validated before processing
6. **File Upload Limits** - 50MB max for media files

---

## Deployment

### On Render

```yaml
# render.yaml or environment variables
- name: EMAIL_USER
  value: your-email@gmail.com

- name: EMAIL_PASSWORD
  value: your-app-password

- name: APP_URL
  value: https://my-chsapi.onrender.com

- name: MONGODB_URI
  value: mongodb+srv://...
```

### Generate QR Codes

```bash
# SSH into Render server or run locally
node scripts/generate-complaint-qrs.js

# Output QR codes to `/uploads/qr-codes/`
```

---

## Future Enhancements

- [ ] WhatsApp notification integration
- [ ] SMS status updates
- [ ] AI-based complaint categorization
- [ ] Multi-language support
- [ ] Complaint history on profile
- [ ] Photo recognition for complaint type
- [ ] Similar complaint detection
- [ ] Feedback rating after resolution

---

## Support

For issues or questions:
1. Check logs: `tail -f logs/app.log`
2. Test endpoint: `curl http://api/api/anonymous-complaints`
3. Verify email config: Check `.env` file
4. Check database: Verify MongoDB connection and collections
