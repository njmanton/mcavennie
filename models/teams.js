'use strict';

const Team = (sequelize, DataTypes) => {

  let model = sequelize.define('teams', {
    id: {
      type: DataTypes.INTEGER(10),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(64),
      allowNull: false
    },
    sname: {
      type: DataTypes.STRING,
      allowNull: true
    },
    country: {
      type: DataTypes.STRING(3),
      allowNull: true
    },
    englishleague: {
      type: DataTypes.INTEGER(4),
      allowNull: true
    }
  });

  return model;

};

module.exports = Team;
