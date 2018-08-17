'use strict';

const User = (sequelize, DataTypes) => {

  const model = sequelize.define('users', {
    id: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    facebook_id: {
      type: DataTypes.STRING,
      allowNull: true
    },
    google_id: {
      type: DataTypes.STRING,
      allowNull: true
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '0'
    },
    resetpwd: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    },
    admin: {
      type: DataTypes.INTEGER(4),
      allowNull: true,
      defaultValue: '0'
    },
    lastlogin: {
      type: DataTypes.DATE,
      allowNull: true
    },
    timezone: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    games: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    balance: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    confirmed: {
      type: DataTypes.INTEGER(4),
      allowNull: true,
      defaultValue: '0'
    }
  });

  return model;

};

module.exports = User;
