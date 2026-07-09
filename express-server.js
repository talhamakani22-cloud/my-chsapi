require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const { connectDB } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 1001;
const isProduction = process.env.NODE_ENV === 'production';
const isRender = String(process.env.RENDER || '').toLowerCase() === 'true';
const forceCrossSiteCookie = String(process.env.SESSION_CROSS_SITE || '').toLowerCase() === 'true' || isRender;
const uploadsRoot = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, 'uploads');
const allowedOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Required on Render/proxied deployments so secure cookies work correctly.
app.set('trust proxy', 1);

// Connect to DB once
connectDB();

// Middleware
const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser tools and same-origin server calls.
    if (!origin) return callback(null, true);

    if (!allowedOrigins.length) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('CORS origin not allowed'));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    secure: forceCrossSiteCookie ? true : isProduction,
    httpOnly: true,
    sameSite: forceCrossSiteCookie ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  }
}));

// Routes
const authRouter = require('./api/auth');
const visitorsRouter = require('./api/visitors');
const sessionRouter = require('./api/session');
const familyRouter = require('./api/family');
const ocrRouter = require('./api/ocr');
const vehicleRouter = require('./api/vehicle');
const maintenanceRouter = require('./api/maintenance');
const notificationsRouter = require('./api/notifications');
const meetingChatRouter = require('./api/meetingChat');
const complaintsRouter = require('./api/complaints');
const anonymousComplaintsRouter = require('./api/anonymousComplaints');
app.use('/api/auth', authRouter);
app.use('/api/auth', sessionRouter);
app.use('/api/visitors', visitorsRouter);
app.use('/api/family', familyRouter);
app.use('/api/ocr', ocrRouter);
app.use('/api/vehicle', vehicleRouter);
app.use('/api/maintenance', maintenanceRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/meeting-chat', meetingChatRouter);
app.use('/api/complaints', complaintsRouter);
app.use('/api/anonymous-complaints', anonymousComplaintsRouter);
app.use('/uploads', express.static(uploadsRoot));

// Protected route

// Session-based authentication removed
// All routes are now public or should use token-based auth

app.get('/api/dashboard', (req, res) => {
  res.json({ message: 'Welcome to the dashboard (no session)' });
});


app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Logout failed.' });
    }
    res.clearCookie('connect.sid'); // Default session cookie name
    res.json({ success: true, message: 'Logged out' });
  });
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Express server is running!' });
});



app.listen(PORT, () => {
  console.log(`Express server running on port ${PORT}`);
});