const passport = require("passport");
const TwitterStrategy = require("passport-twitter").Strategy;
const User = require("../models/User");
const jwt = require("jsonwebtoken");

passport.use(
  new TwitterStrategy(
    {
      consumerKey: process.env.TWITTER_CONSUMER_KEY,
      consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
      callbackURL: process.env.TWITTER_CALLBACK_URL,
      includeEmail: true,
    },
    async (token, tokenSecret, profile, done) => {
      // console.log("Raw Twitter profile:", profile);

      try {
        const { id, displayName, username, photos, emails, _json } = profile;

        const twitterData = {
          fullName: displayName,
          username: "@" + username.toLowerCase(),
          email: emails?.[0]?.value || null,
          twitterId: id,
          authProvider: "twitter",
          balance: { testnet: 100, locked: 0 },
          wallet: { address: "", privateKey: "" }
        };

        // 1️⃣ Find existing user
        let user = await User.findOne({ twitterId: id });

        const mergeUserData = (user, newData) => {
          let updated = false;

          for (const key in newData) {
            const newValue = newData[key];
            const oldValue = user[key];

            // Handle objects
            if (
              typeof newValue === "object" &&
              newValue !== null &&
              !Array.isArray(newValue)
            ) {
              if (!user[key]) {
                user[key] = {}; // ✅ prevent crash
              }

              for (const subKey in newValue) {
                if (
                  oldValue?.[subKey] === undefined ||
                  oldValue?.[subKey] === null
                ) {
                  user[key][subKey] = newValue[subKey];
                  updated = true;
                }
              }
            }
            // Handle primitives
            else {
              if (!oldValue && newValue !== undefined) {
                user[key] = newValue;
                updated = true;
              }
            }
          }

          return updated;
        };


        if (!user) {
          user = await User.create(twitterData);
        } else {
          // ONLY give bonus if balance doesn't exist at all
          if (!user.balance || user.balance.testnet === undefined) {
            user.balance = { testnet: 100, locked: 0 };
          }

          const updated = mergeUserData(user, twitterData);
          if (updated) await user.save();
        }

        console.log("Saved Twitter user:", user);
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

module.exports = passport;