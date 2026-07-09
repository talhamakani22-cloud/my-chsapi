const express = require('express');
const router = express.Router();

router.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    res.on('finish', () => {
      const payload = req.body && typeof req.body === 'object' ? req.body : {};
      console.log('[Incoming request body]', {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        ...payload,
        uploadedFile: req.file
          ? {
              originalname: req.file.originalname,
              mimetype: req.file.mimetype,
              size: req.file.size,
              filename: req.file.filename,
            }
          : null,
        timestamp: new Date().toISOString(),
      });
    });
  }
  next();
});

// GET /api/auth/session - Check if user session exists
router.get('/session', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ loggedIn: true, user: req.session.user });
  }
  return res.json({ loggedIn: false });
});

module.exports = router;
