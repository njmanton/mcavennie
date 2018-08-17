'use strict';

const Match = (sequelize, DataTypes) => {

  const Op      = require('sequelize').Op,
        moment  = require('moment'),
        logger  = require('winston'),
        config  = require('../utils/config');

  let model = sequelize.define('matches', {
    id: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    teama_id: {
      type: DataTypes.INTEGER(4),
      allowNull: true
    },
    teamb_id: {
      type: DataTypes.INTEGER(4),
      allowNull: true
    },
    league_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    gotw: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    result: {
      type: DataTypes.STRING,
      allowNull: true
    },
    date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    week_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    odds1: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    odds2: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    oddsX: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    game: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  });

  model.outstanding = async () => {
    const models = require('.');

    try {
      const matches = await models.Match.findAll({
        where: { date: { [Op.lt]: moment() }, result: null, week_id: { [Op.gte]: config.goalmine.league_start } },
        attributes: ['id', 'date', 'result', 'week_id'],
        include: [{
          model: models.Team,
          as: 'TeamA',
          attributes: ['name']
          }, {
          model: models.Team,
          as: 'TeamB',
          attributes: ['name']
          }, {
          model: models.League,
          attributes: ['name', 'country']
        }]
      });
      matches.map(m => m.fdate = moment(m.date).format('ddd DD MMM') );
      return matches;

    } catch (e) {
      logger.error(`Could not get outstanding matches. (${ e })`);
      return null;
    }

  };

  return model;

};

module.exports = Match;
