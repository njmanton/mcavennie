'use strict';

const League = (sequelize, DataTypes) => {

  let model = sequelize.define('leagues', {
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
    country: {
      type: DataTypes.STRING(3),
      allowNull: true
    },
    sport: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    international: {
      type: DataTypes.INTEGER(10),
      allowNull: true,
      defaultValue: 0
    }
  }, {
    tableName: 'leagues',
    freezeTableName: true
  });

  return model;

};

module.exports = League;
