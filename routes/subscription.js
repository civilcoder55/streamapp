// imports
const express = require("express");
const router = express.Router();
const Plan = require("../models/plan");
const stripe = require("stripe")("token_here");
//---------------------------------------------------------------------------//
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

router.get("/plans", async function (req, res) {
  plans = await Plan.findAll({ raw: true });
  res.render("plans", { plans, title: "Plans", messages: messages(req) });
});

router.get("/plan/:id", require("connect-ensure-login").ensureLoggedIn("/signin"), async function (req, res) {
  plan = await Plan.findOne({ raw: true, where: { id: req.params.id } });
  if (req.user.subscription.plan.type == plan.type) {
    req.flash("warning", `You already subscribed to ${plan.type} Package`);
    return res.redirect("/plans");
  }
  if (req.user.subscription.plan.id > plan.id) {
    req.flash("error", `You can't downgrade your Package`);
    return res.redirect("/plans");
  }
  if (req.user.subscription.plan.id > 1) {
    req.flash("error", `You can't upgrade until your current package ends`);
    return res.redirect("/plans");
  }
  const session = await stripe.checkout.sessions.create({
    customer_email: req.user.email,
    payment_method_types: ["card"],
    line_items: [
      {
        name: plan.type + " Package",
        amount: Math.ceil(plan.price) * 100,
        currency: "usd",
        quantity: 1,
      },
    ],
    metadata: {
      customer: req.user.id,
      plan: plan.id,
    },
    success_url: req.protocol + "://" + req.get("host") + "/plans",
    cancel_url: req.protocol + "://" + req.get("host") + "/plans",
  });
  res.render("wait", { sessionId: session.id });
});

module.exports = router;
