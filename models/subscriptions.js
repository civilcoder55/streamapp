const Sequelize = require("sequelize");
const sequelize = require("../utilis/db.js");
const Plan = require("./plan");

//Subscription table to store all users Subscriptions
const Subscriptions = sequelize.define("subscriptions", {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },
  price: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
  start: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW,
  },
  end: { type: Sequelize.DATE },
});

//One to many relationship with PLan table
Subscriptions.belongsTo(Plan, {
  foreignKey: {
    allowNull: false,
    defaultValue: 1,
  },
});
Plan.hasMany(Subscriptions);

module.exports = Subscriptions;
