const express = require('express');
const router = express.Router();

// GET /api/auth/session - Check if user session exists
router.get('/session', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ loggedIn: true, user: req.session.user });
  }
  return res.json({ loggedIn: false });
});

module.exports = router;
