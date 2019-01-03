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

  model.getMatches = async () => {

    const models = require('.'),
          Op     = require('sequelize').Op,
          teams  = {};

    try {
      const matches = await models.Match.findAll({
        where: { result: { [Op.ne]: null } },
        attributes: [],
        include: [{
          model: models.Team,
          as: 'TeamA',
          attributes: ['id', 'name', 'country']
        }, {
          model: models.Team,
          as: 'TeamB',
          attributes: ['id', 'name', 'country']
        }]
      });
      matches.map(match => {
        if (teams[match.TeamA.name] == undefined) {
          teams[match.TeamA.name] = { matches: 1, id: match.TeamA.id, country: match.TeamA.country };
        } else {
          teams[match.TeamA.name].matches++;
        }
        if (teams[match.TeamB.name] == undefined) {
          teams[match.TeamB.name] = { matches: 1, id: match.TeamB.id, country: match.TeamB.country };
        } else {
          teams[match.TeamB.name].matches++;
        }
      });
      return teams;

    } catch (e) {

      return e;

    }

  };

  return model;

};

module.exports = Team;
