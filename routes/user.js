// imports
const express = require("express");
const router = express.Router();
const Subscriptions = require("../models/subscriptions");
const Users = require("../models/users");
const Op = require("sequelize").Op;
const bcrypt = require("bcryptjs");
const validator = require("validator");
const passwordValidator = require("password-validator");
const jwt = require("jsonwebtoken");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey("token_here");
//---------------------------------------------------------------------------//

// authentication utilis functions//

//function to redirect user if authenticated used when logged in user try to access signin or singup pages
function ifAuthRedir(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect("/");
  }
  next();
}
//function to ensure the flash messages is not an empty array
function messages(req) {
  let messages = req.flash();
  if (Object.keys(messages).length > 0) {
    messages = messages;
  } else {
    messages = null;
  }
  return messages;
}
// schema to require complex passwords when register
const schema = new passwordValidator();
schema.is().min(8).is().max(20).has().symbols().has().uppercase().has().lowercase().has().digits().has().not().spaces();
//---------------------------------------------------------------------------//

// route methods
module.exports = function (passport) {
  router.get("/signin", ifAuthRedir, function (req, res) {
    res.render("signin", { messages: messages(req) });
  });
  //--------------------------------------------//
  router.post(
    "/signin",
    ifAuthRedir,
    passport.authenticate("local", {
      failureRedirect: "/signin",
      failureFlash: true,
    }),
    function (req, res) {
      if (req.body.remember == "on") {
        req.session.cookie.maxAge = 2 * 24 * 3600000;
      } else {
        req.session.cookie.expires = false;
      }

      return res.redirect("/");
    }
  );
  //--------------------------------------------//
  router.get("/signup", ifAuthRedir, function (req, res) {
    res.render("signup", { messages: messages(req) });
  });
  //--------------------------------------------//
  router.post("/signup", ifAuthRedir, async function (req, res) {
    let { email, username, password, password2, remember } = req.body;

    if (email && username && password && password2) {
      email = validator.trim(email);
      var user = await Users.findOne({
        where: { [Op.or]: [{ username: username }, { email: email }] },
      });
      if (user) {
        if (user.username == username) {
          req.flash("error", "Username already taken");
        }
        req.flash("error", "Email already taken");
        return res.redirect("/signup");
      } else {
        if (validator.contains(username, " ")) {
          req.flash("error", "Username must be one word");
          return res.redirect("/signup");
        }
        if (!validator.isEmail(email)) {
          req.flash("error", "Please enter a valid email");
          return res.redirect("/signup");
        }
        if (!validator.equals(password, password2)) {
          req.flash("error", `Passwords don't match`);
          return res.redirect("/signup");
        }
        if (!schema.validate(password)) {
          req.flash("error", `Password should be between 8-20 char & contains at least one uppercase/lowercase letters , digits & symbol`);
          return res.redirect("/signup");
        }
        if (remember != "on") {
          req.flash("error", "You should agree terms");
          return res.redirect("/signup");
        }
        var user = await Users.create({ email, username, password });
        freeSub = await Subscriptions.create({ price: "0", planId: 1 });
        freeSub.setUser(user);
        req.login(user, function (err) {
          return res.redirect("/");
        });
      }
    } else {
      req.flash("error", "Fields are missing");
      res.redirect("/signup");
    }
  });
  //--------------------------------------------//

  router.get("/profile", require("connect-ensure-login").ensureLoggedIn("/signin"), async function (req, res) {
    return res.render("profile", { messages: messages(req) });
  });
  //--------------------------------------------//
  router.post("/profile", require("connect-ensure-login").ensureLoggedIn("/signin"), async function (req, res) {
    if (!validator.isEmail(req.body.email)) {
      req.flash("error", "Please enter a valid email");
      return res.redirect("/profile");
    }
    profile = await Users.update(
      {
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        email: req.body.email,
      },
      { where: { id: req.user.id } }
    );
    return res.redirect("/profile");
  });

  //--------------------------------------------//
  router.post("/change_password", require("connect-ensure-login").ensureLoggedIn("/signin"), async function (req, res, next) {
    var user = await Users.findOne({ where: { id: req.user.id } });
    if (user) {
      check = await bcrypt.compare(req.body.oldpass, user.password());
      if (check) {
        if (!validator.equals(req.body.newpass, req.body.confirmpass)) {
          req.flash("error", `Passwords don't match`);
          return res.redirect("/profile");
        }
        if (!schema.validate(req.body.newpass)) {
          req.flash("error", `Password should be between 8-20 char & contains at least one uppercase/lowercase letters , digits & symbol`);
          return res.redirect("/profile");
        }

        await user.update({ password: req.body.newpass });
        maxAge = req.session.cookie.maxAge;
        return req.session.regenerate((err) => {
          req.session.reload((err) => {
            req.flash("success", "Password changed successfuly");
            req.login(user, function (err) {});
            req.session.cookie.maxAge = maxAge;

            req.session.save((err) => {
              res.redirect("/profile");
            });
          });
        });
      } else {
        req.flash("error", "Old Password is incorrect");
        return res.redirect("/profile");
      }
    }
    req.flash("error", "Something Wrong");
  });
  //--------------------------------------------//
  router.get("/forgot", ifAuthRedir, async function (req, res) {
    res.render("forgot", { messages: messages(req) });
  });

  router.get("/reset/:token", ifAuthRedir, async function (req, res) {
    token = req.params.token;
    if (token) {
      try {
        data = jwt.verify(token, "thisisasecret");
        var user = await Users.findOne({ where: { id: data.id } });
        if (token == user.resetToken) {
          res.render("reset", { messages: messages(req) });
        } else {
          return res.send("reset link is invalid or expired");
        }
      } catch (err) {
        console.log(err);
        return res.send("reset link is invalid or expired");
      }
    }
  });
  router.post("/reset/:token", ifAuthRedir, async function (req, res) {
    token = req.params.token;
    const { password, password2 } = req.body;
    if (token) {
      try {
        data = jwt.verify(token, "thisisasecret");
        var user = await Users.findOne({ where: { id: data.id } });
        if (token == user.resetToken) {
          if (!validator.equals(password, password2)) {
            req.flash("error", `Passwords don't match`);
            return res.redirect("/reset/" + token);
          }
          if (!schema.validate(password)) {
            req.flash("error", `Password should be between 8-20 char & contains at least one uppercase/lowercase letters , digits & symbol`);
            return res.redirect("/reset/" + token);
          }
          await user.update({ password: password });
          await user.update({ resetToken: null });
          req.flash("success", `your password has been reseted`);
          return res.redirect("/signin");
        } else {
          return res.send("reset link is invalid or expired");
        }
      } catch (err) {
        console.log(err);
        return res.send("reset link is invalid or expired");
      }
    }
    return res.send("something is missing");
  });
  //--------------------------------------------//
  router.post("/forgot", ifAuthRedir, async function (req, res) {
    if (req.body.email) {
      var user = await Users.findOne({ where: { email: req.body.email } });
      if (user) {
        token = jwt.sign({ id: user.id }, "thisisasecret", { expiresIn: "1d" });
        await user.update({ resetToken: token });
        req.flash("success", "Rest link has been sent to your email");
        const msg = {
          to: user.email,
          from: "info@backenddev.co",
          subject: "Nodejs Streaming site reset password",
          text: "Click the link to reset your password",
          html: `<a href="https://stream.backenddev.co/reset/${token}" >click here to reset your password</a>`,
        };
        sgMail.send(msg);
        return res.redirect("/forgot");
      } else {
        req.flash("error", `there is no account with this email`);
        return res.redirect("/forgot");
      }
    } else {
      req.flash("error", `please provide your email`);
      return res.redirect("/forgot");
    }
  });
  //--------------------------------------------//

  router.get("/logout", require("connect-ensure-login").ensureLoggedIn("/"), function (req, res) {
    req.logout();
    req.session.destroy(function (err) {
      res.redirect("/");
    });
  });
  //--------------------------------------------//
  return router;
};
