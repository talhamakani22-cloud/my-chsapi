require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const { connectDB } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 1001;

// Connect to DB once
connectDB();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

// Routes
const authRouter = require('./api/auth');
const visitorsRouter = require('./api/visitors');
const sessionRouter = require('./api/session');
const familyRouter = require('./api/family');
const ocrRouter = require('./api/ocr');
const vehicleRouter = require('./api/vehicle');
const maintenanceRouter = require('./api/maintenance');
app.use('/api/auth', authRouter);
app.use('/api/auth', sessionRouter);
app.use('/api/visitors', visitorsRouter);
app.use('/api/family', familyRouter);
app.use('/api/ocr', ocrRouter);
app.use('/api/vehicle', vehicleRouter);
app.use('/api/maintenance', maintenanceRouter);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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