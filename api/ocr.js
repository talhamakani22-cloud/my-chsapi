const express = require('express');
const router = express.Router();
const multer = require('multer');
const Tesseract = require('tesseract.js');
const OCR_MAX_FILE_SIZE_MB = Number(process.env.OCR_MAX_FILE_SIZE_MB || 30);
const OCR_MAX_FILE_SIZE_BYTES = Math.max(1, OCR_MAX_FILE_SIZE_MB) * 1024 * 1024;

// Set up multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: OCR_MAX_FILE_SIZE_BYTES,
  },
});

function handleImageUpload(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: `Image too large. Please upload an image under ${OCR_MAX_FILE_SIZE_MB}MB.`,
      });
    }

    return res.status(400).json({
      error: err.message || 'Invalid image upload.',
    });
  });
}

// POST /api/ocr - Accepts an image and returns extracted text
router.post('/', handleImageUpload, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded.' });
  }
  try {
    const { buffer } = req.file;
    const result = await Tesseract.recognize(buffer, 'eng');
    res.json({ text: result.data.text });
  } catch (error) {
    res.status(500).json({ error: 'OCR processing failed.', details: error.message });
  }
});

module.exports = router;
