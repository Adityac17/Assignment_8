const mongoose = require('mongoose');

/**
 * Connect to MongoDB using the MONGODB_URI environment variable.
 *
 * This function NEVER throws / never calls process.exit(). No live MongoDB is
 * guaranteed in every environment, so a failed or missing connection is logged
 * clearly and the caller (server.js) is still allowed to start Express. Any
 * request that actually needs the DB will surface a Mongoose error which the
 * centralized error handler turns into a clean JSON response.
 *
 * @returns {Promise<boolean>} true if connected, false otherwise.
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri || !uri.trim()) {
    console.warn(
      '[db] WARNING: MONGODB_URI is not set. Skipping MongoDB connection.\n' +
        '     The API will start, but any route that touches the database will fail\n' +
        '     until you add a valid MONGODB_URI to your .env file. See README "Database Setup".'
    );
    return false;
  }

  try {
    // serverSelectionTimeoutMS keeps the app from hanging for the default 30s
    // when the URI is unreachable.
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
    });
    console.log(`[db] MongoDB connected: ${mongoose.connection.host}`);

    mongoose.connection.on('error', (err) => {
      console.error('[db] MongoDB runtime error:', err.message);
    });
    mongoose.connection.on('disconnected', () => {
      console.warn('[db] MongoDB disconnected.');
    });

    return true;
  } catch (err) {
    console.warn(
      `[db] WARNING: Could not connect to MongoDB (${err.message}).\n` +
        '     The API will still start. Fix MONGODB_URI (see README "Database Setup")\n' +
        '     and restart to enable database-backed routes.'
    );
    return false;
  }
}

module.exports = connectDB;
