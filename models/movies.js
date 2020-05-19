const Sequelize = require("sequelize");
const sequelize = require("../utilis/db.js");
const Genre = require("../models/genre");

//Movies table
const Movies = sequelize.define("movies", {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },
  title: { type: Sequelize.STRING, allowNull: false, unique: true },
  rate: { type: Sequelize.DECIMAL(10, 1) },
  year: { type: Sequelize.INTEGER },
  time: { type: Sequelize.INTEGER },
  country: { type: Sequelize.STRING },
  desc: { type: Sequelize.TEXT },
  type: { type: Sequelize.STRING, allowNull: false, defaultValue: "Basic" },
});

// Many to many relationship with genres
Movies.belongsToMany(Genre, { through: "friendship" });
Genre.belongsToMany(Movies, { through: "friendship" });

module.exports = Movies;
