const Sequelize = require("sequelize");
const sequelize = require("../utilis/db.js");
const Subscriptions = require("./subscriptions");
const bcrypt = require("bcryptjs");
//users table
const Users = sequelize.define("users", {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },

  username: { type: Sequelize.STRING, unique: true },
  email: { type: Sequelize.STRING, unique: true },
  password: {
    type: Sequelize.STRING,
    get() {
      return () => this.getDataValue("password");
    },
  },
  firstname: { type: Sequelize.STRING },
  lastname: { type: Sequelize.STRING },
  resetToken: { type: Sequelize.STRING },
  isAdmin: { type: Sequelize.BOOLEAN, defaultValue: false },
});
//One to one relationship with Subscription table
Subscriptions.belongsTo(Users, { onDelete: "CASCADE", hooks: true });
Users.hasOne(Subscriptions);
//method to valid password hash used when login user
Users.prototype.validPassword = function (password) {
  return bcrypt.compare(password, this.password());
};
//method to hash password before user stored used when Register user
Users.beforeCreate(async (user, options) => {
  hashedPassword = await bcrypt.hash(user.password(), 12);
  user.password = hashedPassword;
});
//method to hash password before user updated used when change/reset password
Users.beforeUpdate(async (user, options) => {
  if (user.changed("password")) {
    hashedPassword = await bcrypt.hash(user.password(), 12);
    user.password = hashedPassword;
  }
});
module.exports = Users;
