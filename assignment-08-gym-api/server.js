require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors');

const connectDB = require('./config/db');
const configurePassport = require('./config/passport');

const authRoutes = require('./routes/authRoutes');
const classRoutes = require('./routes/classRoutes');
const memberRoutes = require('./routes/memberRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// --- core middleware ------------------------------------------------------
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- session + passport ---------------------------------------------------
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev_only_insecure_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

configurePassport();
app.use(passport.initialize());
app.use(passport.session());

// --- health check ---------------------------------------------------------
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Gym & Fitness Club Management API is running',
    data: {
      dbConnected: require('mongoose').connection.readyState === 1,
    },
  });
});

// --- routes ---------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/members', memberRoutes);

// --- 404 handler ----------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// --- centralized error handler --------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// --- startup --------------------------------------------------------------
// IMPORTANT: Express starts even if the DB connection fails/absent. connectDB
// never throws; it logs a clear warning and resolves false.
async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[server] Listening on http://localhost:${PORT}`);
  });
}

// Only auto-start when run directly (so tests can require the app if needed).
if (require.main === module) {
  start();
}

module.exports = app;
