// packages imports
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const SequelizeStore = require("connect-session-sequelize")(session.Store);
const csrfProtection = require("csurf")();
const flash = require("connect-flash");
const passport = require("./utilis/strategy");
const kue = require("kue");
// database & models imports
const Sequelize = require("sequelize");
const sequelize = require("./utilis/db.js");
const Users = require("./models/users");
const Movies = require("./models/movies");
const Genre = require("./models/genre");
const Plan = require("./models/plan");
const Subscriptions = require("./models/subscriptions");
// routes imports
const userRouter = require("./routes/user")(passport);
const moviesRouter = require("./routes/movies");
const subscriptionRouter = require("./routes/subscription");
const streamRouter = require("./routes/stream");
const adminRouter = require("./routes/admin");
const app = express();
app.disable("etag");
// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// middlewares
app.use(
  express.json({
    verify: function (req, res, buf) {
      var url = req.originalUrl;
      if (url.startsWith("/checkout/webhook")) {
        req.rawBody = buf.toString();
      }
    },
  })
);
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(session({ secret: "my secret", resave: false, saveUninitialized: false, store: new SequelizeStore({ db: sequelize }) }));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
//----------------------------------------------------------------------------------------------------------------------------------\\
app.use(
  "/kue-api/",
  function (req, res, next) {
    if (req.isAuthenticated()) {
      next();
    } else {
      res.send("not auth");
    }
  },
  kue.app
);
//----------------------------------------------------------------------------------------------------------------------------------\\
app.post("/checkout/webhook", async function (req, res) {
  const endpointSecret = "whsec_nivYPq2zT9HRtJgCtYyD7MV1DnirJtDU";
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = require("stripe")("token_here").webhooks.constructEvent(req.rawBody, sig, endpointSecret);
  } catch (err) {
    return res.status(400);
  }
  // Handle the checkout.session.completed event
  if (event.type === "checkout.session.completed") {
    const metadata = event.data.object.metadata;
    now = new Date();
    await Subscriptions.update(
      { planId: metadata.plan, start: new Date(), end: new Date(now.setMonth(now.getMonth() + 1)) },
      { where: { userId: metadata.customer } }
    );
    return res.sendStatus(200);
  }
});
//----------------------------------------------------------------------------------------------------------------------------------\\

app.use(csrfProtection);
app.use((req, res, next) => {
  // middleware to store csrf and req data into res local to access it into templates
  res.locals.csrfToken = req.csrfToken();
  res.locals.req = req;
  next();
});

// middleware to check for subscription time (update it to free package if time is up)
app.use(async (req, res, next) => {
  if (req.isAuthenticated()) {
    today = new Date();
    if (req.user.subscription.end < today) {
      await Subscriptions.update({ planId: 1 }, { where: { userId: req.user.id } });
    }
  }
  next();
});

// routes
app.use("/", userRouter);
app.use("/", moviesRouter);
app.use("/", streamRouter);
app.use("/", adminRouter);
app.use("/", subscriptionRouter);
app.use(function (req, res, next) {
  return res.status(404).render("error", { status: 404, title: "Page Not Found" });
});
app.use(function (err, req, res, next) {
  return res.status(500).render("error", { status: 500, title: "Internal Server Error" });
});

sequelize
  .sync()
  .then((result) => {
    app.listen(4000, () => {
      console.log("app is running on port 4000");
    });
  })
  .catch((err) => {
    console.log(err);
  });
