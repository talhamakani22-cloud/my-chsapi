#!/usr/bin/env node
/**
 * Complete Setup & QR Code Generation Script
 * Configures email, generates QR codes, and creates printable documents
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const EMAIL_SETUP = `
╔════════════════════════════════════════════════════════════════════════════════╗
║                     📧 EMAIL CONFIGURATION SETUP                              ║
║                  For Anonymous Complaint Notifications                         ║
╚════════════════════════════════════════════════════════════════════════════════╝

STEP 1: Choose Email Provider
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ RECOMMENDED: Gmail with App Password

  1. Go to: https://myaccount.google.com/security
  2. Enable "2-Step Verification" (if not enabled)
  3. Go to: https://myaccount.google.com/apppasswords
  4. Select: Mail → Windows Computer (or your device)
  5. Copy the 16-character password
  6. Use this password in .env file

  .env Configuration:
  ┌─────────────────────────────────────────┐
  │ EMAIL_SERVICE=gmail                     │
  │ EMAIL_USER=your-email@gmail.com         │
  │ EMAIL_PASSWORD=xxxx xxxx xxxx xxxx      │
  │ EMAIL_FROM_NAME=CHS Complaints          │
  └─────────────────────────────────────────┘


STEP 2: Alternative - Use Company SMTP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  .env Configuration:
  ┌──────────────────────────────────────────────┐
  │ EMAIL_SERVICE=smtp                           │
  │ EMAIL_HOST=mail.yourdomain.com               │
  │ EMAIL_PORT=587                               │
  │ EMAIL_SECURE=false                           │
  │ EMAIL_USER=complaints@yourdomain.com         │
  │ EMAIL_PASSWORD=your-password                 │
  │ EMAIL_FROM_NAME=CHS Complaints System        │
  └──────────────────────────────────────────────┘


STEP 3: Test Email Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Run test script:
  $ node scripts/test-email-config.js

  This will:
  ✓ Verify email credentials
  ✓ Send test email
  ✓ Display connection details


STEP 4: Update Environment Variables
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Edit .env file in project root:

  # Email Configuration
  EMAIL_SERVICE=gmail
  EMAIL_USER=your-email@gmail.com
  EMAIL_PASSWORD=your-app-password
  EMAIL_FROM_NAME=CHS Complaints

  # App Configuration
  APP_URL=https://my-chsapi.onrender.com
  MONGODB_URI=mongodb+srv://...

  # Optional
  UPLOADS_DIR=/uploads
  NODE_ENV=production


STEP 5: Deployment on Render
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  1. Go to: https://dashboard.render.com
  2. Select your web service
  3. Go to: Settings → Environment
  4. Add all email variables:
     - EMAIL_SERVICE=gmail
     - EMAIL_USER=your-email@gmail.com
     - EMAIL_PASSWORD=your-app-password
     - EMAIL_FROM_NAME=CHS Complaints
  5. Click "Deploy" to apply changes


IMPORTANT SECURITY NOTES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ⚠️  NEVER commit .env file to git
  ⚠️  ALWAYS use App Passwords, not regular passwords
  ⚠️  Keep credentials confidential
  ⚠️  Rotate credentials periodically
  ⚠️  Monitor email account for suspicious activity


TROUBLESHOOTING:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Problem: "Invalid login credentials"
  Solution: Verify password is correct, use App Password not regular password

  Problem: "Failed to connect to email server"
  Solution: Check EMAIL_HOST and EMAIL_PORT, verify firewall allows connection

  Problem: "Email not received"
  Solution: Check spam folder, verify recipient email is correct

  Problem: "SSL/TLS certificate error"
  Solution: For Gmail, ensure EMAIL_SECURE=false with port 587


NEXT STEPS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  1. Configure email credentials in .env
  2. Test with: node scripts/test-email-config.js
  3. Run QR generation: node scripts/generate-complaint-qrs.js
  4. Print and display QR codes
  5. Test mobile app with real QR codes
  6. Deploy to Render with env vars

`;

const QR_SETUP = `
╔════════════════════════════════════════════════════════════════════════════════╗
║                     📱 QR CODE GENERATION & PRINTING                          ║
║                      Setup Guide for Building Layout                           ║
╚════════════════════════════════════════════════════════════════════════════════╝

STEP 1: Define Your Building Structure
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Edit config/building-layout.json:

  {
    "buildingName": "Your Building Name",
    "buildingCode": "BLD001",
    "flats": {
      "Block A": ["101", "102", "103", "104", "105"],
      "Block B": ["201", "202", "203", "204", "205"],
      "Block C": ["301", "302", "303", "304", "305"],
      "Villas": ["V101", "V102", "V103"]
    },
    "commonAreas": [
      { "name": "Main Gate", "id": "GATE-01" },
      { "name": "Lobby", "id": "LOBBY-01" },
      { "name": "Parking", "id": "PARK-01" }
    ]
  }


STEP 2: Generate QR Codes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Run the generation script:
  $ node scripts/generate-complaint-qrs.js

  This will create:
  ✓ /public/qr-codes/building-layout.html - Visual guide
  ✓ /public/qr-codes/printable.html - Ready to print
  ✓ /public/qr-codes/qr-*.png - Individual QR codes
  ✓ /public/qr-codes/index.json - QR metadata


STEP 3: Review Generated Files
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  1. Open: public/qr-codes/building-layout.html
     Shows: Visual layout of all QR code locations

  2. Open: public/qr-codes/printable.html
     Shows: Ready-to-print format for notice boards

  3. Check: /public/qr-codes/*.png
     Each file is a high-resolution QR code


STEP 4: Print QR Codes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Option A: Print from Browser
  1. Open: public/qr-codes/printable.html
  2. Press: Ctrl+P (Windows) or Cmd+P (Mac)
  3. Choose: A4 paper size
  4. Set margins: Minimal (at least 10mm)
  5. Print!

  Option B: Print Individual QR Codes
  1. Right-click on QR code image
  2. Select: "Print Image"
  3. Choose: 10cm x 10cm size (4"x4" inches)
  4. Laminate for durability


STEP 5: Display on Notice Boards
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Recommended Locations:
  ✓ Main building entrance
  ✓ Elevator lobbies (each floor)
  ✓ Parking area entrance
  ✓ Common amenities area
  ✓ Swimming pool area
  ✓ Gym / Recreation area
  ✓ Community center
  ✓ Each residential floor


STEP 6: Display Instructions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Create signage to display with QR codes:

  ╔═══════════════════════════════════════════════════════════════════════════╗
  ║                   📱 REGISTER A COMPLAINT IN SECONDS                     ║
  ║                                                                           ║
  ║  1. Point your phone camera at this QR code                              ║
  ║  2. Click the link that appears                                          ║
  ║  3. Fill in the complaint form (no login needed)                         ║
  ║  4. Upload photo/video (optional)                                        ║
  ║  5. Submit → Get your ticket number instantly                            ║
  ║  6. Check status anytime via email link                                  ║
  ║                                                                           ║
  ║  ↓ SCAN HERE ↓                                                           ║
  ║                                                                           ║
  ║                    [QR CODE IMAGE HERE]                                  ║
  ║                                                                           ║
  ║  Questions? Contact Management Office                                    ║
  ║  Email: complaints@building.com                                          ║
  ║  Phone: +971-50-XXXXX                                                    ║
  ╚═══════════════════════════════════════════════════════════════════════════╝


STEP 7: Share Digitally
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Email to Residents:
  - Attach PDF of printable.html
  - Include link to: https://my-chsapi.onrender.com/anonymous-complaints

  WhatsApp:
  - Send QR code image
  - Send complaint form link
  - Share usage instructions

  Building App:
  - Add link to resident portal
  - Display QR code in announcements
  - Provide direct form link


STEP 8: Test QR Codes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  1. Use any smartphone camera or QR scanner app
  2. Point at printed QR code
  3. Verify it opens: https://my-chsapi.onrender.com/anonymous-complaints
  4. Fill sample complaint
  5. Verify email receipt
  6. Check ticket status via email link


QR CODE SPECIFICATIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Size: 300x300 pixels (10cm x 10cm)
  Format: PNG (transparent background)
  Error Correction: High (H) - survives up to 30% damage
  Resolution: 300 DPI (for printing)
  Color: Black on white (high contrast)


MAINTENANCE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✓ Check QR codes monthly for damage
  ✓ Replace if faded or damaged
  ✓ Re-generate if URL changes
  ✓ Update signage if complaint types change
  ✓ Monitor complaint volume


CUSTOMIZATION OPTIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Pre-fill Complaint Type:
  https://...anonymous-complaints?type=Maintenance

  Pre-fill Flat Number:
  https://...anonymous-complaints?flat=101

  Combined:
  https://...anonymous-complaints?flat=101&type=Maintenance

`;

console.log(EMAIL_SETUP);
console.log('\n\n');
console.log(QR_SETUP);

// Save guides to files
const guidesDir = path.join(__dirname, '..', 'docs', 'guides');
if (!fs.existsSync(guidesDir)) {
  fs.mkdirSync(guidesDir, { recursive: true });
}

fs.writeFileSync(
  path.join(guidesDir, 'EMAIL_SETUP.md'),
  EMAIL_SETUP.replace(/╔.*?╗/gs, '').trim()
);

fs.writeFileSync(
  path.join(guidesDir, 'QR_SETUP.md'),
  QR_SETUP.replace(/╔.*?╗/gs, '').trim()
);

console.log('\n\n✅ Setup guides saved to /docs/guides/\n');
console.log('📋 NEXT STEPS:');
console.log('1. node scripts/test-email-config.js         - Test email setup');
console.log('2. node scripts/generate-complaint-qrs.js    - Generate QR codes');
console.log('3. Print and display QR codes on notice boards');
console.log('4. Test with mobile app by scanning QR codes\n');
