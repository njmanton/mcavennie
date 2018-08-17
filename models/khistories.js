'use strict';

const Khistory = (sequelize, DataTypes) => {

  const model = sequelize.define('khistories', {
    id: {
      type: DataTypes.INTEGER(10),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    killer_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null
    },
  });

  return model;
};

module.exports = Khistory;
