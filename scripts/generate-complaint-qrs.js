#!/usr/bin/env node
/**
 * Generate QR Codes for Anonymous Complaint Forms
 * Usage: node scripts/generate-complaint-qrs.js
 */

const QRCodeGenerator = require('../utils/qrCodeGenerator');
const path = require('path');
const fs = require('fs');

const APP_URL = process.env.APP_URL || 'https://my-chsapi.onrender.com';
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'qr-codes');

async function main() {
  try {
    console.log('[🎯 QR Code Generator] Starting...\n');
    console.log(`App URL: ${APP_URL}`);
    console.log(`Output Directory: ${OUTPUT_DIR}\n`);

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      console.log(`[✅ Created output directory]\n`);
    }

    // Generate general complaint form QR
    console.log('[1️⃣ Generating General Complaint Form QR Code...');
    const generalQR = await QRCodeGenerator.generateAnonymousComplaintQR(APP_URL, OUTPUT_DIR);
    console.log(`   ✅ Saved: ${generalQR}\n`);

    // Generate data URL for embedding (in PDFs, emails, etc)
    console.log('[2️⃣ Generating QR Code as Data URL (for embedding)...');
    const dataUrl = await QRCodeGenerator.generateQRDataUrl(APP_URL);
    const dataUrlPath = path.join(OUTPUT_DIR, 'qr-data-url.txt');
    fs.writeFileSync(dataUrlPath, dataUrl);
    console.log(`   ✅ Saved: ${dataUrlPath}\n`);

    // Generate QR codes for each flat (if you have a list)
    const sampleFlats = ['101', '102', '103', '104', '105', '201', '202', '203', '204', '205'];
    console.log('[3️⃣ Generating QR Codes for Sample Flats...');
    const flatQRs = await QRCodeGenerator.generateBatchQRCodes(
      sampleFlats,
      APP_URL,
      OUTPUT_DIR
    );
    console.log(`   ✅ Generated ${flatQRs.length} QR codes\n`);

    // Create an index HTML file to view all QR codes
    console.log('[4️⃣ Creating QR Code Index HTML...');
    const indexHtml = generateIndexHtml(flatQRs);
    const indexPath = path.join(OUTPUT_DIR, 'index.html');
    fs.writeFileSync(indexPath, indexHtml);
    console.log(`   ✅ Saved: ${indexPath}\n`);

    console.log('[✅ QR Code Generation Complete!]\n');
    console.log('Summary:');
    console.log(`  • General QR Code: ${generalQR}`);
    console.log(`  • QR Data URL: ${dataUrlPath}`);
    console.log(`  • Flat-Specific QR Codes: ${flatQRs.length} files`);
    console.log(`  • Index HTML: ${indexPath}`);
    console.log('\nYou can now:');
    console.log(`  1. Print QR codes from ${OUTPUT_DIR}`);
    console.log('  2. Display on building notice boards');
    console.log('  3. Include in resident emails and PDFs');
    console.log(`  4. View all QR codes: ${indexPath}`);
  } catch (err) {
    console.error('[❌ Error]', err.message);
    process.exit(1);
  }
}

/**
 * Generate HTML index to display all QR codes
 */
function generateIndexHtml(flatQRs) {
  const qrList = flatQRs
    .map(
      (qr) =>
        `<div class="qr-item">
      <h3>Flat ${qr.flatNumber}</h3>
      <img src="${path.basename(qr.filepath)}" alt="QR for Flat ${qr.flatNumber}">
      <p>Link: <code>${qr.url}</code></p>
      <button onclick="window.print()">Print</button>
    </div>`
    )
    .join('\n');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CHS Anonymous Complaint QR Codes</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    header {
      background: white;
      padding: 30px;
      border-radius: 10px;
      margin-bottom: 30px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    header h1 {
      color: #333;
      margin-bottom: 10px;
    }
    header p {
      color: #666;
      margin: 5px 0;
    }
    .qr-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }
    .qr-item {
      background: white;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      text-align: center;
      page-break-inside: avoid;
    }
    .qr-item h3 {
      color: #333;
      margin-bottom: 15px;
      font-size: 18px;
    }
    .qr-item img {
      max-width: 100%;
      height: auto;
      margin: 15px 0;
      border: 2px solid #eee;
      padding: 10px;
    }
    .qr-item code {
      background: #f5f5f5;
      padding: 8px 12px;
      border-radius: 5px;
      display: block;
      font-size: 12px;
      margin: 10px 0;
      word-break: break-all;
      color: #333;
    }
    .qr-item button {
      background: #667eea;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 5px;
      cursor: pointer;
      margin-top: 10px;
      font-size: 14px;
    }
    .qr-item button:hover {
      background: #764ba2;
    }
    .instructions {
      background: white;
      padding: 20px;
      border-radius: 10px;
      margin-bottom: 30px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .instructions h2 {
      color: #333;
      margin-bottom: 15px;
    }
    .instructions ol {
      color: #666;
      margin-left: 20px;
    }
    .instructions li {
      margin: 10px 0;
    }
    @media print {
      body { background: white; }
      .instructions { display: none; }
      .qr-grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🏢 CHS Anonymous Complaint System</h1>
      <p><strong>QR Code Directory</strong> for Public Complaint Registration</p>
      <p>Users can scan these QR codes with their phone camera to register complaints without login.</p>
    </header>

    <div class="instructions">
      <h2>📋 How to Use</h2>
      <ol>
        <li>Print the QR codes for each flat</li>
        <li>Display on building notice boards or resident forums</li>
        <li>Share via email or messaging apps</li>
        <li>Residents scan with phone camera to register complaints</li>
        <li>Complaints are tracked via ticket number and email</li>
      </ol>
    </div>

    <div class="qr-grid">
      ${qrList}
    </div>
  </div>
</body>
</html>
`;
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { main, generateIndexHtml };
