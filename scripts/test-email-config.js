#!/usr/bin/env node
/**
 * Test Email Configuration
 * Verifies email credentials and sends test email
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const EMAIL_SERVICE = process.env.EMAIL_SERVICE || 'gmail';
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'CHS Complaints';

console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                      📧 EMAIL CONFIGURATION TEST                            ║
╚══════════════════════════════════════════════════════════════════════════════╝

🔍 Configuration Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Service:   ${EMAIL_SERVICE}
User:      ${EMAIL_USER || '❌ NOT CONFIGURED'}
From Name: ${EMAIL_FROM_NAME}
Password:  ${EMAIL_PASSWORD ? '✅ Configured' : '❌ NOT CONFIGURED'}

`);

if (!EMAIL_USER || !EMAIL_PASSWORD) {
  console.error(`
❌ ERROR: Email configuration incomplete!

Required environment variables:
  EMAIL_USER=your-email@gmail.com
  EMAIL_PASSWORD=your-app-password
  EMAIL_SERVICE=gmail (default)

Add these to your .env file:
  
  # Email Configuration
  EMAIL_SERVICE=gmail
  EMAIL_USER=your-email@gmail.com
  EMAIL_PASSWORD=your-16-char-app-password
  EMAIL_FROM_NAME=CHS Complaints
  APP_URL=https://my-chsapi.onrender.com

Then run this test again.
`);
  process.exit(1);
}

async function testEmailConfiguration() {
  try {
    console.log('🔗 Connecting to email server...');

    const transporter = nodemailer.createTransport({
      service: EMAIL_SERVICE,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD,
      },
    });

    // Verify connection
    console.log('⏳ Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!\n');

    // Send test email
    console.log('📨 Sending test email...');
    const testEmail = EMAIL_USER; // Send to self

    const mailOptions = {
      from: `"${EMAIL_FROM_NAME}" <${EMAIL_USER}>`,
      to: testEmail,
      subject: '✅ CHS Complaint System - Email Test',
      html: `
        <h2>Email Configuration Test</h2>
        <p>This is a test email from your CHS Complaint System.</p>
        <p>If you received this, your email configuration is working correctly!</p>
        
        <h3>Configuration Details:</h3>
        <ul>
          <li><strong>Service:</strong> ${EMAIL_SERVICE}</li>
          <li><strong>From:</strong> ${EMAIL_FROM_NAME}</li>
          <li><strong>Timestamp:</strong> ${new Date().toLocaleString()}</li>
        </ul>

        <h3>Next Steps:</h3>
        <ol>
          <li>Run: <code>node scripts/generate-complaint-qrs.js</code></li>
          <li>Print and display QR codes on notice boards</li>
          <li>Test complaint form with mobile app</li>
          <li>Deploy to Render with these email credentials</li>
        </ol>

        <p style="color: #999; font-size: 12px; margin-top: 20px;">
          This email was sent automatically from CHS Complaint System.
        </p>
      `,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Test email sent successfully!\n');

    console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                        ✅ ALL TESTS PASSED!                                 ║
╚══════════════════════════════════════════════════════════════════════════════╝

Email Configuration Status:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ SMTP Connection:   SUCCESS
✓ Authentication:    SUCCESS
✓ Test Email Sent:   SUCCESS (${result.messageId})
✓ Recipient:         ${testEmail}

Your email is configured and working correctly!

📋 NEXT STEPS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Generate QR codes:
   $ node scripts/generate-complaint-qrs.js

2. Print and display QR codes on notice boards

3. Test mobile app:
   - Scan printed QR code
   - Fill complaint form
   - Verify email receipt

4. Deploy to Render:
   - Add EMAIL_* variables to Render environment
   - Redeploy the application

🔗 Deployment Environment Variables for Render:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  EMAIL_SERVICE=${EMAIL_SERVICE}
  EMAIL_USER=${EMAIL_USER}
  EMAIL_PASSWORD=******* (set in Render dashboard)
  EMAIL_FROM_NAME=${EMAIL_FROM_NAME}

Visit Render Dashboard: https://dashboard.render.com
  1. Select your web service
  2. Go to Settings → Environment
  3. Add the above variables
  4. Click "Deploy"

`);
  } catch (err) {
    console.error(`
❌ EMAIL CONFIGURATION TEST FAILED!

Error: ${err.message}

Troubleshooting:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If using Gmail:
1. Verify you're using an App Password (not regular password)
2. Go to: https://myaccount.google.com/apppasswords
3. Generate a new 16-character password
4. Enable 2-Step Verification first
5. Copy the exact password without spaces

If using custom SMTP:
1. Verify EMAIL_HOST and EMAIL_PORT are correct
2. Check firewall allows outbound SMTP connections
3. Verify USERNAME and PASSWORD are correct
4. Try with EMAIL_SECURE=false if using port 587

Common Issues:
• "Invalid login": Wrong password or not using App Password
• "Connection refused": Wrong host/port
• "Auth failed": Credentials don't match
• "ENOTFOUND": Email host doesn't exist

`);
    process.exit(1);
  }
}

testEmailConfiguration();
