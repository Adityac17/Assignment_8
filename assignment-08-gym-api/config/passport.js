const passport = require('passport');
const { Strategy: LocalStrategy } = require('passport-local');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

/**
 * Configure Passport with a username + password local strategy plus
 * session (de)serialization by Mongo _id.
 */
function configurePassport() {
  passport.use(
    new LocalStrategy(
      { usernameField: 'username', passwordField: 'password' },
      async (username, password, done) => {
        try {
          const user = await User.findOne({ username: username.trim() });
          if (!user) {
            return done(null, false, { message: 'Invalid username or password' });
          }

          const match = await bcrypt.compare(password, user.password);
          if (!match) {
            return done(null, false, { message: 'Invalid username or password' });
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  // Store only the Mongo _id in the session.
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Rehydrate the full user from the _id on each request.
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user || false);
    } catch (err) {
      done(err);
    }
  });
}

module.exports = configurePassport;
