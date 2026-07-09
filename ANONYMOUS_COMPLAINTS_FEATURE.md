# Anonymous Complaint Registration Feature

## Overview

This feature allows residents to **register complaints without login** by scanning a QR code. It includes:

- ✅ Public complaint registration form (no authentication needed)
- ✅ Image/video upload support
- ✅ Automatic ticket number generation
- ✅ Email verification for status tracking
- ✅ Public status check page
- ✅ QR code generation for each flat

## Setup

### 1. Environment Variables

Add to `.env`:

```env
# Email Configuration (for sending verification links)
EMAIL_SERVICE=gmail          # or your email provider
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# App URL (for email verification links)
APP_URL=https://app.example.com    # or your app domain
```

### 2. Install Dependencies

The backend uses `nodemailer` for email sending. Ensure it's installed:

```bash
npm install nodemailer qrcode
```

### 3. Database Collections

The feature automatically creates these MongoDB collections:
- `anonymous_complaints` - Stores all anonymous complaint data
- `family_detail` - Used to verify flat owners

### 4. Generate QR Codes

Run the QR code generator to create codes for all flats:

```bash
node generate-qr-codes.js
```

This creates PNG files in `/qr-codes` directory. Each QR code links to:
```
https://app.example.com/complaints/anonymous?flat=FLAT_NUMBER
```

Print and place these QR codes near complaint boxes in each flat area.

## API Endpoints

### 1. Register Anonymous Complaint

**POST** `/api/anonymous-complaints`

Request (FormData):
```
flatNumber: "101"
complaintType: "Maintenance"
description: "Water leakage in bathroom"
email: "resident@example.com"
phone: "+971501234567"
complaintMedia: <file> (JPG/PNG/MP4/MOV)
```

Or JSON with Base64:
```json
{
  "flatNumber": "101",
  "complaintType": "Maintenance",
  "description": "Water leakage in bathroom",
  "email": "resident@example.com",
  "phone": "+971501234567",
  "complaintMediaBase64": "iVBORw0KGgoAAAA...",
  "complaintMediaName": "leak.jpg",
  "complaintMediaMimeType": "image/jpeg"
}
```

Response:
```json
{
  "success": true,
  "message": "Complaint registered successfully.",
  "ticket": {
    "ticketNo": "ANON-1720591200000-ABC12D3",
    "flatNumber": "101",
    "ownerName": "John Resident",
    "complaintType": "Maintenance",
    "status": "Open",
    "createdAt": "2026-07-09T10:30:00.000Z",
    "emailVerificationSent": true
  }
}
```

### 2. Check Complaint Status

**GET** `/api/anonymous-complaints/{ticketNumber}/status?token={verificationToken}`

Response:
```json
{
  "success": true,
  "complaint": {
    "ticketNo": "ANON-1720591200000-ABC12D3",
    "flatNumber": "101",
    "ownerName": "John Resident",
    "complaintType": "Maintenance",
    "description": "Water leakage in bathroom",
    "status": "In Progress",
    "statusNote": "Maintenance team assigned",
    "createdAt": "2026-07-09T10:30:00.000Z",
    "updatedAt": "2026-07-09T14:45:00.000Z",
    "mediaAvailable": true,
    "mediaKind": "image"
  }
}
```

### 3. List All Anonymous Complaints (Admin)

**GET** `/api/anonymous-complaints`

Query Parameters:
- `search` - Search by ticket, flat, name, type, or description

Response:
```json
{
  "success": true,
  "complaints": [...]
}
```

## Frontend Integration

### 1. Anonymous Complaint Form

**File:** `app/AnonymousComplaint.tsx`

Features:
- Flat number input with owner name lookup
- Multiple complaint types (Maintenance, Noise, Cleanliness, Parking, Other)
- Image/video upload with compression
- Email and phone validation
- Real-time base64 encoding
- Success page with ticket display

**Usage:**
```tsx
import AnonymousComplaint from '@/app/AnonymousComplaint';

// In your navigation
<Stack.Screen name="AnonymousComplaint" component={AnonymousComplaint} />
```

### 2. Complaint Status Check Page

**File:** `app/ComplaintStatusCheck.tsx`

Features:
- Enter ticket number and verification token
- Deep linking support for email links
- Status visualization with colors and icons
- Display complaint details
- Media attachment indicator

**Usage:**
```tsx
import ComplaintStatusCheck from '@/app/ComplaintStatusCheck';

// In your navigation
<Stack.Screen name="ComplaintStatusCheck" component={ComplaintStatusCheck} />
```

### 3. Deep Linking Configuration

Update `app.json` to support deep links:

```json
{
  "expo": {
    "scheme": "myapp",
    "plugins": [
      [
        "expo-notifications",
        {}
      ]
    ]
  },
  "extra": {
    "deepLink": {
      "anonymous-complaints": "complaints/anonymous",
      "complaint-status": "complaints/status"
    }
  }
}
```

## User Flow

### Registering a Complaint

1. **Scan QR Code**
   - User scans QR code with phone camera
   - Automatically opens complaint registration form

2. **Enter Details**
   - Enter flat number (owner name auto-fills)
   - Select complaint type
   - Describe the issue
   - Upload image/video
   - Enter email and phone

3. **Submit**
   - Click "Register Complaint"
   - Receives unique ticket number
   - Confirmation page displays immediately

4. **Email Notification**
   - Email sent with verification link
   - Link contains ticket number and verification token
   - Valid for 7 days

### Checking Status

**Option 1: Click Email Link**
- Open email
- Click verification link
- Automatically loads complaint status

**Option 2: Manual Entry**
- Open "Check Complaint Status" page
- Enter ticket number
- Enter verification token from email
- View current status

## Status Workflow

States:
- **Open** (🔴) - Just registered
- **In Progress** (🟡) - Being reviewed
- **Resolved** (🟢) - Fixed/Addressed
- **Closed** (⚪) - No action needed

Admins can update status via:
```bash
PUT /api/complaints/{complaintId}/status
{
  "status": "resolved",
  "statusNote": "Issue has been fixed"
}
```

## Database Schema

### Anonymous Complaints Collection

```javascript
{
  _id: ObjectId,
  ticketNo: String,                    // Unique ticket number
  flatNumber: String,                  // e.g., "101"
  ownerName: String,                   // From family_detail
  complaintType: String,               // Maintenance, Noise, etc.
  description: String,                 // Complaint details
  mediaUri: String,                    // /uploads/complaints/...
  mediaAvailable: Boolean,
  mediaMimeType: String,               // image/jpeg, video/mp4, etc.
  mediaKind: String,                   // 'image' or 'video'
  status: String,                      // Open, In Progress, Resolved, Closed
  statusNote: String,                  // Admin note
  isAnonymous: Boolean,                // true
  email: String,                       // Resident email
  phone: String,                       // Resident phone
  verificationToken: String,           // 32-byte hex token
  verificationTokenExpiry: Date,       // 7 days from creation
  createdAt: Date,
  updatedAt: Date
}
```

## Email Template

The verification email includes:

```
Subject: Complaint Registered - Ticket #ANON-1720591200000-ABC12D3

Dear Resident,

Your complaint has been registered successfully.

Details:
- Ticket Number: ANON-1720591200000-ABC12D3
- Flat Number: 101
- Complaint Type: Maintenance
- Registered At: July 9, 2026, 10:30 AM

[Check Complaint Status Button]
Link: https://app.com/complaints/status?ticket=ANON-1720591200000-ABC12D3&token=abc123...

This link is valid for 7 days. Bookmark this page or save your ticket number for future reference.

Best regards,
CHS Management System
```

## Testing

### Test Anonymous Complaint Registration

```bash
curl -X POST https://api.example.com/api/anonymous-complaints \
  -F "flatNumber=101" \
  -F "complaintType=Maintenance" \
  -F "description=Test complaint" \
  -F "email=test@example.com" \
  -F "phone=+971501234567" \
  -F "complaintMedia=@/path/to/image.jpg"
```

### Test Status Check

```bash
curl "https://api.example.com/api/anonymous-complaints/ANON-1720591200000-ABC12D3/status?token=verification_token_here"
```

## Troubleshooting

### Email Not Sending

1. Check EMAIL_USER and EMAIL_PASSWORD in .env
2. For Gmail: Use "App Password" not regular password
3. Enable "Less secure app access" if needed
4. Check nodemailer logs: `console.error()` in anonymousComplaints.js

### QR Code Not Working

1. Ensure APP_URL in .env is correct
2. Verify QR code was generated after environment setup
3. Check that app is properly handling deep links
4. Test URL manually in browser: `https://app.com/complaints/anonymous?flat=101`

### Flat Not Found Error

1. Ensure flat number exists in `family_detail` collection
2. Check flat number format matches what's in database
3. Verify `residentName` field exists in family record

### Verification Token Expired

1. Email links valid for 7 days only
2. User must create new complaint for new token
3. Consider extending token expiry in code if needed

## Security Considerations

✅ **What's Secure:**
- Verification tokens are 32-byte cryptographic hashes
- Token expires after 7 days
- Email verification required for status check
- Image/video size limits (50MB)
- File type validation (JPG/PNG/MP4/MOV only)

⚠️ **What to Monitor:**
- Rate limit anonymous endpoints if needed
- Monitor for spam complaints
- Review email delivery logs
- Check for suspicious file uploads

## Future Enhancements

- [ ] SMS notifications for status updates
- [ ] Multiple image uploads per complaint
- [ ] Comment/reply system for admin
- [ ] Complaint priority levels
- [ ] Auto-assignment to maintenance staff
- [ ] Scheduled complaint reminders
- [ ] Mobile app deep linking
- [ ] Blockchain ticket verification
- [ ] Multiple language support
- [ ] Complaint categories by floor/building

## Support & Maintenance

**Logs Location:**
- Backend: Console output with `[✅]` and `[❌]` prefixes
- Email: Check SMTP delivery logs
- Database: MongoDB Atlas activity logs

**Regular Tasks:**
- Monthly QR code regeneration for new flats
- Weekly verification of complaint status workflow
- Email delivery monitoring
- Token expiry cleanup (auto-handled by MongoDB TTL)

---

**Created:** July 9, 2026  
**Version:** 1.0  
**Status:** Production Ready
