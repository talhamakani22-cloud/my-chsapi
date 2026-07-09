/**
 * QR Code Generator Utility for Anonymous Complaints
 * Generates QR codes that link to the anonymous complaint form
 */

const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

class QRCodeGenerator {
  /**
   * Generate QR code for anonymous complaint form
   * @param {string} appUrl - Base URL of the app (e.g., https://my-chsapi.onrender.com)
   * @param {string} outputPath - Path to save QR code image
   * @returns {Promise<string>} - Path to generated QR code image
   */
  static async generateAnonymousComplaintQR(
    appUrl = 'https://my-chsapi.onrender.com',
    outputPath = path.join(__dirname, '..', 'qr-codes')
  ) {
    try {
      // Create output directory if it doesn't exist
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }

      // URL for anonymous complaint form
      const complaintUrl = `${appUrl}/anonymous-complaints`;

      // Generate QR code image
      const filename = `complaint-${Date.now()}.png`;
      const filepath = path.join(outputPath, filename);

      await QRCode.toFile(filepath, complaintUrl, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      console.log(`[✅ QR Code Generated] ${filepath}`);
      return filepath;
    } catch (err) {
      console.error('[❌ QR Code Generation Error]', err.message);
      throw err;
    }
  }

  /**
   * Generate QR code with custom parameters
   * @param {object} params - Parameters object
   * @returns {Promise<string>} - Path to generated QR code
   */
  static async generateCustomQR(params = {}) {
    const {
      flatNumber = '',
      complaintType = '',
      appUrl = 'https://my-chsapi.onrender.com',
      outputPath = path.join(__dirname, '..', 'qr-codes'),
    } = params;

    try {
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }

      // Build URL with optional parameters
      let url = `${appUrl}/anonymous-complaints`;
      const queryParams = [];

      if (flatNumber) queryParams.push(`flat=${encodeURIComponent(flatNumber)}`);
      if (complaintType) queryParams.push(`type=${encodeURIComponent(complaintType)}`);

      if (queryParams.length > 0) {
        url += `?${queryParams.join('&')}`;
      }

      const filename = `complaint-custom-${Date.now()}.png`;
      const filepath = path.join(outputPath, filename);

      await QRCode.toFile(filepath, url, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 300,
        margin: 2,
      });

      console.log(`[✅ Custom QR Code Generated] ${filepath}`);
      return filepath;
    } catch (err) {
      console.error('[❌ Custom QR Code Generation Error]', err.message);
      throw err;
    }
  }

  /**
   * Generate QR code as data URL (for embedding in emails/documents)
   * @param {string} appUrl - Base URL of the app
   * @returns {Promise<string>} - QR code as data URL
   */
  static async generateQRDataUrl(appUrl = 'https://my-chsapi.onrender.com') {
    try {
      const complaintUrl = `${appUrl}/anonymous-complaints`;

      const dataUrl = await QRCode.toDataURL(complaintUrl, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 300,
        margin: 2,
      });

      console.log('[✅ QR Code Data URL Generated]');
      return dataUrl;
    } catch (err) {
      console.error('[❌ QR Data URL Generation Error]', err.message);
      throw err;
    }
  }

  /**
   * Generate QR code for status checking
   * @param {string} trackingToken - Anonymous complaint tracking token
   * @param {string} appUrl - Base URL of the app
   * @param {string} outputPath - Path to save QR code
   * @returns {Promise<string>} - Path to generated QR code
   */
  static async generateStatusCheckQR(
    trackingToken,
    appUrl = 'https://my-chsapi.onrender.com',
    outputPath = path.join(__dirname, '..', 'qr-codes')
  ) {
    try {
      if (!trackingToken) {
        throw new Error('Tracking token is required');
      }

      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }

      const statusUrl = `${appUrl}/complaint-status/${trackingToken}`;

      const filename = `status-${trackingToken.substring(0, 8)}.png`;
      const filepath = path.join(outputPath, filename);

      await QRCode.toFile(filepath, statusUrl, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 300,
        margin: 2,
      });

      console.log(`[✅ Status Check QR Code Generated] ${filepath}`);
      return filepath;
    } catch (err) {
      console.error('[❌ Status QR Code Generation Error]', err.message);
      throw err;
    }
  }

  /**
   * Batch generate QR codes for multiple flats
   * @param {array} flats - Array of flat numbers
   * @param {string} appUrl - Base URL
   * @param {string} outputPath - Output directory
   * @returns {Promise<array>} - Array of generated filepaths
   */
  static async generateBatchQRCodes(
    flats = [],
    appUrl = 'https://my-chsapi.onrender.com',
    outputPath = path.join(__dirname, '..', 'qr-codes')
  ) {
    try {
      if (!Array.isArray(flats) || flats.length === 0) {
        throw new Error('Flats array is required and cannot be empty');
      }

      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }

      const results = [];

      for (const flatNumber of flats) {
        const url = `${appUrl}/anonymous-complaints?flat=${encodeURIComponent(flatNumber)}`;
        const filename = `complaint-flat-${String(flatNumber).replace(/\D/g, '')}-${Date.now()}.png`;
        const filepath = path.join(outputPath, filename);

        await QRCode.toFile(filepath, url, {
          errorCorrectionLevel: 'H',
          type: 'image/png',
          width: 300,
          margin: 2,
        });

        results.push({
          flatNumber,
          filepath,
          url,
        });

        console.log(`[✅ QR Generated for Flat ${flatNumber}] ${filepath}`);
      }

      return results;
    } catch (err) {
      console.error('[❌ Batch QR Generation Error]', err.message);
      throw err;
    }
  }
}

module.exports = QRCodeGenerator;
