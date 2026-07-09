/**
 * QR Code Generator for Anonymous Complaints
 * Usage: node generate-qr-codes.js
 * Generates QR codes linking to the anonymous complaint registration page
 */

const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const APP_URL = process.env.APP_URL || 'https://app.com';
const OUTPUT_DIR = path.join(__dirname, 'qr-codes');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Generate QR code for anonymous complaint registration
 * @param {string} flatNumber - The flat number (e.g., '101', 'Block A')
 * @param {boolean} savePNG - Whether to save as PNG (default: true)
 */
async function generateComplaintQRCode(flatNumber, savePNG = true) {
  try {
    // URL format: https://app.com/complaints/anonymous?flat=101
    const qrUrl = `${APP_URL}/complaints/anonymous?flat=${encodeURIComponent(flatNumber)}`;

    // Generate QR code data URL
    const dataUrl = await QRCode.toDataURL(qrUrl, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    if (savePNG) {
      // Convert data URL to PNG buffer
      const buffer = Buffer.from(dataUrl.split(',')[1], 'base64');
      const filename = `complaint-flat-${flatNumber.replace(/[/\\:*?"<>|]/g, '-')}.png`;
      const filepath = path.join(OUTPUT_DIR, filename);

      fs.writeFileSync(filepath, buffer);
      console.log(`✅ QR Code generated: ${filepath}`);
      console.log(`   URL: ${qrUrl}`);
      console.log(`   Flat: ${flatNumber}\n`);

      return filepath;
    } else {
      return dataUrl;
    }
  } catch (err) {
    console.error(`❌ Error generating QR code for flat ${flatNumber}:`, err.message);
    throw err;
  }
}

/**
 * Generate QR codes for multiple flats
 * @param {string[]} flats - Array of flat numbers
 */
async function generateMultipleQRCodes(flats) {
  console.log(`\nGenerating QR codes for ${flats.length} flats...\n`);

  for (const flat of flats) {
    await generateComplaintQRCode(flat);
  }

  console.log(`\n✅ All QR codes generated in: ${OUTPUT_DIR}`);
}

// Example usage with sample flats
const sampleFlats = [
  '101', '102', '103', '104', '105',
  'Block A', 'Block B', 'Block C',
];

if (require.main === module) {
  generateMultipleQRCodes(sampleFlats)
    .then(() => {
      console.log('\n📋 QR Code Summary:');
      console.log('   - Each QR code links to the anonymous complaint form');
      console.log('   - Print and place QR codes near complaint boxes');
      console.log('   - Users scan to register complaints without login');
      console.log('   - Email verification for status tracking');
    })
    .catch((err) => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { generateComplaintQRCode, generateMultipleQRCodes };
