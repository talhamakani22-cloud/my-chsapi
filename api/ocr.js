const express = require('express');
const router = express.Router();
const multer = require('multer');
const Tesseract = require('tesseract.js');

// Set up multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// POST /api/ocr - Accepts an image and returns extracted text
router.post('/', upload.single('image'), async (req, res) => {
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
