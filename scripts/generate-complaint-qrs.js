#!/usr/bin/env node
/**
 * Enhanced QR Code Generation for Anonymous Complaints
 * Generates printable documents with QR codes for building layout
 */

require('dotenv').config();
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const buildingLayout = require('../config/building-layout.json');
const APP_URL = process.env.APP_URL || buildingLayout.configuration.appUrl;
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'qr-codes');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                  📱 GENERATING QR CODES FOR COMPLAINT SYSTEM                ║
║                         Building: ${buildingLayout.buildingName.padEnd(50)}║
╚══════════════════════════════════════════════════════════════════════════════╝

Configuration:
  • Building: ${buildingLayout.buildingName}
  • Blocks: ${buildingLayout.blocks.length}
  • Total Flats: ${buildingLayout.totalFlats}
  • Common Areas: ${buildingLayout.commonAreas.filter(a => a.generateQR).length}
  • Output Directory: ${OUTPUT_DIR}
  • App URL: ${APP_URL}

Generating QR Codes...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`);

const qrCodes = [];
let generateCount = 0;

async function generateQRCode(code, type = 'flat', label = '') {
  try {
    const url = `${APP_URL}/anonymous-complaints?code=${encodeURIComponent(code)}`;
    const safeFilename = code.replace(/[/\\:*?"<>|]/g, '-');
    const filename = `qr-${type}-${safeFilename}.png`;
    const filepath = path.join(OUTPUT_DIR, filename);

    await QRCode.toFile(filepath, url, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 2,
    });

    qrCodes.push({
      code,
      type,
      label,
      filename,
      filepath,
      url,
      displayName: label || code,
    });

    generateCount++;
    console.log(`  ✓ [${generateCount}] ${type.padEnd(10)} ${(label || code).padEnd(25)} → ${filename}`);

    return filepath;
  } catch (err) {
    console.error(`  ✗ Error generating QR for ${code}:`, err.message);
  }
}

async function generateAllQRCodes() {
  try {
    // Generate QR codes for all residential flats
    console.log('\n📍 RESIDENTIAL FLATS:');
    for (const block of buildingLayout.blocks) {
      console.log(`\n   ${block.blockName}:`);
      for (const flat of block.flats) {
        await generateQRCode(flat, 'flat', `${block.blockCode} - Flat ${flat}`);
      }
    }

    // Generate QR codes for common areas
    console.log('\n\n📍 COMMON AREAS:');
    for (const area of buildingLayout.commonAreas) {
      if (area.generateQR) {
        await generateQRCode(area.code, 'area', area.name);
      }
    }

    // Generate general building QR code
    console.log('\n📍 GENERAL:');
    await generateQRCode('BUILDING', 'general', buildingLayout.buildingName);

    console.log(`\n\n✅ Generated ${generateCount} QR codes\n`);

    // Generate HTML documents
    console.log('Generating HTML documents...');
    await generateHTMLIndex();
    await generatePrintableDocument();
    await generateBuildingLayout();
    await generateMetadataJSON();

    console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                        ✅ QR CODE GENERATION COMPLETE                       ║
╚══════════════════════════════════════════════════════════════════════════════╝

Generated Files:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Individual QR Codes: ${generateCount} PNG files
  Location: ${OUTPUT_DIR}

✓ index.html
  View all QR codes in a grid layout
  Open: public/qr-codes/index.html

✓ printable.html
  Ready-to-print format for notice boards
  Open: public/qr-codes/printable.html

✓ building-layout.html
  Visual guide showing where QR codes should be placed
  Open: public/qr-codes/building-layout.html

✓ qr-metadata.json
  All QR code information and URLs
  View: public/qr-codes/qr-metadata.json

📋 NEXT STEPS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 📖 Review the layouts:
   • Open: public/qr-codes/building-layout.html
   • Check: QR code placement locations
   • Verify: All areas are covered

2. 🖨️  Print the documents:
   • Open: public/qr-codes/printable.html
   • Press: Ctrl+P (or Cmd+P on Mac)
   • Select: A4 paper, minimal margins
   • Print!

3. 📌 Display on notice boards:
   • Mount at: Entrance, lobbies, parking, common areas
   • Height: At eye level (160-180cm)
   • Protection: Laminate for durability

4. 📱 Test with mobile app:
   • Download app on smartphone
   • Scan printed QR code
   • Verify form opens correctly

5. 🚀 Deploy to production:
   • Render deployment already configured
   • Push changes: git push
   • All QR codes will work automatically

📧 TEST COMPLAINT SUBMISSION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before printing, test the system:

1. Open: ${APP_URL}/anonymous-complaints
2. Fill form:
   • Flat Number: 101
   • Complaint Type: Maintenance
   • Description: Test complaint
   • Email: your-email@example.com
   • Phone: +971-50-1234567
3. Submit and verify:
   • Ticket number displayed
   • Email received with status link
   • Can check status without login

⚠️  EMAIL CONFIGURATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If test emails are not received:

1. Run: node scripts/test-email-config.js
2. Check: .env file has EMAIL_* variables
3. Verify: Gmail App Password is correct
4. Whitelist: complaints@yourdomain.com in firewall

For more help:
  • node scripts/setup-guide.js
  • docs/ANONYMOUS_COMPLAINTS_GUIDE.md

📊 STATISTICS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total QR Codes Generated: ${generateCount}
  • Residential Flats: ${qrCodes.filter(q => q.type === 'flat').length}
  • Common Areas: ${qrCodes.filter(q => q.type === 'area').length}
  • General Building: ${qrCodes.filter(q => q.type === 'general').length}

Estimated Print Pages: ${Math.ceil(generateCount / 9)} (A4 pages at 3x3 per page)

All QR Codes Point To: ${APP_URL}/anonymous-complaints

`);
  } catch (err) {
    console.error('❌ Error during QR generation:', err);
    process.exit(1);
  }
}

async function generateHTMLIndex() {
  const qrGrid = qrCodes
    .map((qr) => {
      return `
    <div class="qr-card">
      <div class="qr-header">
        <span class="qr-type">${qr.type.toUpperCase()}</span>
        <span class="qr-code">${qr.displayName}</span>
      </div>
      <div class="qr-image">
        <img src="${qr.filename}" alt="QR Code for ${qr.displayName}">
      </div>
      <div class="qr-footer">
        <button onclick="copyUrl('${qr.url}')">Copy URL</button>
        <button onclick="window.open('${qr.url}')">Open</button>
      </div>
    </div>`;
    })
    .join('\n');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CHS QR Codes - All Locations</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    header {
      background: white;
      padding: 30px;
      border-radius: 10px;
      margin-bottom: 30px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    }
    header h1 { color: #333; margin-bottom: 10px; font-size: 28px; }
    header p { color: #666; margin: 5px 0; font-size: 14px; }
    .search-bar {
      margin-top: 15px;
      display: flex;
      gap: 10px;
    }
    .search-bar input {
      flex: 1;
      padding: 10px 15px;
      border: 1px solid #ddd;
      border-radius: 5px;
      font-size: 14px;
    }
    .search-bar button {
      padding: 10px 20px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
    }
    .qr-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 20px;
    }
    .qr-card {
      background: white;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .qr-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 8px 25px rgba(0,0,0,0.15);
    }
    .qr-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .qr-type {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.8;
    }
    .qr-code {
      font-size: 14px;
      font-weight: 600;
    }
    .qr-image {
      padding: 20px;
      text-align: center;
      background: #f9f9f9;
    }
    .qr-image img {
      max-width: 100%;
      height: auto;
      border: 2px solid #eee;
      border-radius: 5px;
      padding: 10px;
    }
    .qr-footer {
      padding: 15px;
      display: flex;
      gap: 10px;
      justify-content: center;
    }
    .qr-footer button {
      padding: 8px 15px;
      font-size: 12px;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      transition: 0.2s;
      flex: 1;
    }
    .qr-footer button:first-child {
      background: #f0f0f0;
      color: #333;
    }
    .qr-footer button:first-child:hover {
      background: #e0e0e0;
    }
    .qr-footer button:last-child {
      background: #667eea;
      color: white;
    }
    .qr-footer button:last-child:hover {
      background: #764ba2;
    }
    .footer {
      text-align: center;
      color: white;
      margin-top: 30px;
      padding: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🏢 ${buildingLayout.buildingName}</h1>
      <p>QR Code Directory for Anonymous Complaint System</p>
      <p>Total Locations: <strong>${generateCount}</strong></p>
      <div class="search-bar">
        <input type="text" id="searchInput" placeholder="Search by flat or location..." onkeyup="filterQRCodes()">
        <button onclick="filterQRCodes()">Search</button>
      </div>
    </header>

    <div class="qr-grid" id="qrGrid">
      ${qrGrid}
    </div>

    <div class="footer">
      <p>Generated on ${new Date().toLocaleString()}</p>
      <p style="font-size: 12px; margin-top: 10px;">Each QR code links to: ${APP_URL}/anonymous-complaints</p>
    </div>
  </div>

  <script>
    function copyUrl(url) {
      navigator.clipboard.writeText(url);
      alert('URL copied to clipboard!');
    }

    function filterQRCodes() {
      const input = document.getElementById('searchInput').value.toLowerCase();
      const cards = document.querySelectorAll('.qr-card');
      
      cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(input) ? '' : 'none';
      });
    }
  </script>
</body>
</html>`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), html);
  console.log('  ✓ Generated: index.html');
}

async function generatePrintableDocument() {
  const qrRows = qrCodes
    .reduce((rows, qr, index) => {
      if (index % 3 === 0) rows.push([]);
      rows[rows.length - 1].push(qr);
      return rows;
    }, [])
    .map((row) => {
      const cells = row
        .map(
          (qr) => `
        <div class="qr-cell">
          <h3>${qr.displayName}</h3>
          <img src="${qr.filename}" alt="QR for ${qr.displayName}">
          <p>${qr.type}</p>
        </div>`
        )
        .join('');
      return `<div class="qr-row">${cells}</div>`;
    })
    .join('');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CHS - Complaint QR Codes (Printable)</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      background: white;
    }
    header {
      text-align: center;
      margin-bottom: 30px;
      page-break-after: always;
    }
    header h1 { font-size: 32px; color: #333; margin-bottom: 10px; }
    header p { font-size: 16px; color: #666; }
    .instructions {
      background: #f5f5f5;
      padding: 20px;
      border-radius: 5px;
      margin-bottom: 30px;
      font-size: 14px;
      line-height: 1.6;
      page-break-after: always;
    }
    .qr-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    .qr-cell {
      text-align: center;
      border: 2px solid #333;
      padding: 20px;
      background: white;
      page-break-inside: avoid;
    }
    .qr-cell h3 {
      font-size: 16px;
      margin-bottom: 10px;
      color: #333;
    }
    .qr-cell img {
      width: 200px;
      height: 200px;
      margin: 10px 0;
      border: 1px solid #ccc;
    }
    .qr-cell p {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #999;
      margin-top: 30px;
      page-break-before: always;
    }
    @media print {
      body { padding: 0; }
      header { page-break-after: always; }
      .instructions { page-break-after: always; }
    }
  </style>
</head>
<body>
  <header>
    <h1>${buildingLayout.buildingName}</h1>
    <p>Anonymous Complaint System - QR Code Directory</p>
  </header>

  <div class="instructions">
    <h2>📋 Instructions for Printing and Display</h2>
    <ol>
      <li><strong>Print:</strong> Use Ctrl+P and select A4 paper size</li>
      <li><strong>Margins:</strong> Set to minimal (10mm)</li>
      <li><strong>Orientation:</strong> Portrait</li>
      <li><strong>Laminate:</strong> For outdoor use</li>
      <li><strong>Display:</strong> Mount at eye level (160-180cm)</li>
      <li><strong>Test:</strong> Scan with mobile phone camera</li>
    </ol>
    
    <h2 style="margin-top: 20px;">🎯 Where to Display</h2>
    <ul>
      <li>Main building entrance</li>
      <li>Elevator lobbies (each floor)</li>
      <li>Parking area entrance</li>
      <li>Common amenities area</li>
      <li>Community notice boards</li>
    </ul>
  </div>

  ${qrRows}

  <div class="footer">
    <p>Generated: ${new Date().toLocaleString()}</p>
    <p>All QR codes link to: ${APP_URL}/anonymous-complaints</p>
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'printable.html'), html);
  console.log('  ✓ Generated: printable.html');
}

async function generateBuildingLayout() {
  const blockSections = buildingLayout.blocks
    .map(
      (block) => `
    <div class="block-section">
      <h3>${block.blockName}</h3>
      <p>${block.description}</p>
      <div class="flats-grid">
        ${block.flats.map((flat) => `<div class="flat">${flat}</div>`).join('')}
      </div>
    </div>`
    )
    .join('');

  const areaCards = buildingLayout.commonAreas
    .filter((a) => a.generateQR)
    .map(
      (area) => `
    <div class="area-card priority-${area.priority}">
      <div class="area-icon">🏢</div>
      <h4>${area.name}</h4>
      <p>${area.description}</p>
      <span class="code">${area.code}</span>
    </div>`
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Building Layout - QR Code Placement Guide</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    header {
      background: white;
      padding: 30px;
      border-radius: 10px;
      margin-bottom: 30px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    }
    header h1 { color: #333; margin-bottom: 10px; }
    header p { color: #666; }
    .layout-sections {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .block-section {
      background: white;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    }
    .block-section h3 {
      color: #333;
      margin-bottom: 10px;
      padding-bottom: 10px;
      border-bottom: 2px solid #667eea;
    }
    .block-section p {
      color: #666;
      font-size: 14px;
      margin-bottom: 15px;
    }
    .flats-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 10px;
    }
    .flat {
      background: #f5f5f5;
      border: 2px solid #667eea;
      border-radius: 5px;
      padding: 10px;
      text-align: center;
      font-weight: 600;
      color: #333;
    }
    .areas-section {
      background: white;
      padding: 20px;
      border-radius: 10px;
      margin-bottom: 30px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    }
    .areas-section h2 {
      color: #333;
      margin-bottom: 20px;
    }
    .areas-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 15px;
    }
    .area-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 10px;
      text-align: center;
      transition: transform 0.2s;
    }
    .area-card:hover {
      transform: translateY(-5px);
    }
    .area-card.priority-1 {
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    }
    .area-card.priority-2 {
      opacity: 0.9;
    }
    .area-icon {
      font-size: 32px;
      margin-bottom: 10px;
    }
    .area-card h4 {
      margin-bottom: 10px;
      font-size: 16px;
    }
    .area-card p {
      font-size: 13px;
      opacity: 0.9;
      margin-bottom: 10px;
    }
    .area-card .code {
      display: inline-block;
      background: rgba(255,255,255,0.2);
      padding: 5px 10px;
      border-radius: 3px;
      font-size: 12px;
      font-weight: 600;
    }
    .legend {
      background: white;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    }
    .legend h3 {
      color: #333;
      margin-bottom: 15px;
    }
    .legend-items {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .legend-badge {
      display: inline-block;
      width: 30px;
      height: 30px;
      border-radius: 5px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🏢 ${buildingLayout.buildingName}</h1>
      <p>QR Code Placement Guide - Building Layout</p>
    </header>

    <div class="areas-section">
      <h2>📍 Priority Placement Locations</h2>
      <div class="areas-grid">
        ${areaCards}
      </div>
    </div>

    <h2 style="color: white; margin-bottom: 20px;">🏠 Residential Blocks & Flats</h2>
    <div class="layout-sections">
      ${blockSections}
    </div>

    <div class="legend">
      <h3>📋 Legend & Guidelines</h3>
      <div class="legend-items">
        <div class="legend-item">
          <span class="legend-badge">P1</span>
          <span>Priority 1 - High traffic areas (Main entrance, Lobby, Parking)</span>
        </div>
        <div class="legend-item">
          <span class="legend-badge">P2</span>
          <span>Priority 2 - Secondary areas (Pool, Gym, Community center)</span>
        </div>
        <div class="legend-item">
          <span class="legend-badge">📱</span>
          <span>Scan with phone camera to open complaint form</span>
        </div>
        <div class="legend-item">
          <span class="legend-badge">✓</span>
          <span>No login required - Anonymous complaint submission</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'building-layout.html'), html);
  console.log('  ✓ Generated: building-layout.html');
}

async function generateMetadataJSON() {
  const metadata = {
    generatedAt: new Date().toISOString(),
    building: buildingLayout.buildingName,
    buildingCode: buildingLayout.buildingCode,
    totalQRCodes: generateCount,
    baseUrl: APP_URL,
    qrCodes: qrCodes.map((qr) => ({
      code: qr.code,
      type: qr.type,
      displayName: qr.displayName,
      filename: qr.filename,
      url: qr.url,
    })),
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, 'qr-metadata.json'), JSON.stringify(metadata, null, 2));
  console.log('  ✓ Generated: qr-metadata.json');
}

// Run the generation
generateAllQRCodes();
