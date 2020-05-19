const Sequelize = require("sequelize");
const sequelize = require("../utilis/db.js");

//Plan table to store all available plans on site
const Plan = sequelize.define("plan", {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },
  type: { type: Sequelize.STRING, unique: true },
  price: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
});

module.exports = Plan;
