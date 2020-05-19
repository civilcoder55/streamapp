const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const Users = require("../models/users");
const Subscriptions = require("../models/subscriptions");
const Plan = require("../models/plan");
const Op = require("sequelize").Op;

passport.use(
  new LocalStrategy(async function (username, password, done) {
    try {
      var user = await Users.findOne({
        where: { [Op.or]: [{ username: username }, { email: username }] },
      });

      if (!user) {
        return done(null, false, {
          message: "Incorrect username or email .",
        });
      }
      pass = await user.validPassword(password);
      if (pass) {
        return done(null, user);
      } else {
        return done(null, false, { message: "Incorrect password." });
      }
    } catch (error) {
      return done(err);
    }
  })
);

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(async function (id, done) {
  try {
    var user = await Users.findOne({
      include: [
        {
          model: Subscriptions,
          include: [Plan],
        },
      ],
      where: { id: id },
    });
    user = user.get({ plain: true });
    delete user.password;
    done(null, user);
  } catch (error) {
    return done(err);
  }
});

module.exports = passport;
