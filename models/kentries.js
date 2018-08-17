'use strict';

const Kentry = (sequelize, DataTypes) => {

  const model = sequelize.define('kentries', {
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
    round_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    week_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    match_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null
    },
    pred: {
      type: DataTypes.ENUM,
      values: ['1', '2', 'X']
    },
    lives: {
      type: DataTypes.INTEGER,
      allowNull: false
    },

  });

    return model;

};

module.exports = Kentry;
