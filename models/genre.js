const Sequelize = require("sequelize");
const sequelize = require("../utilis/db.js");

// simple table to store genres of movies
const Genre = sequelize.define("genre", {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },
  title: { type: Sequelize.STRING, allowNull: false, unique: true },
});

module.exports = Genre;
