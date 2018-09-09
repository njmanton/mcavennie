'use strict';

const logger  = require('winston'),
      config  = require('../utils/config');

const Week = (sequelize, DataTypes) => {

  const model = sequelize.define('weeks', {
    id: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    start: {
      type: DataTypes.DATE,
      allowNull: false
    },
    status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  });

  // finishes all workflows for a given week
  model.finalise = async wid => {
    const models = require('.');
    let promises = [];

    try {
      if (!wid) throw new Error('no week supplied');
      // set the week instance to complete (status 1)
      promises.push(models.Week.update({ status: 1 }, { where: { id: wid } }));
      // get all goalmine players for the week
      promises.push(models.Prediction.getPlayers(wid));
      // get the winner(s) of goalmine
      promises.push(models.Standing.findAll({ where: { position: 1, week_id: wid }, attributes: ['user_id'] }));
      // tie up any killer entries
      promises.push(models.Killer.resolveWeek(wid));

      const [complete, players, winners, killers] = await Promise.all(promises);

      logger.info(`processed ${ killers } killer entries with prediction`);
      const check = await models.Killer.checkWinner(wid);
      if (check) logger.info(`processed ${ check } killer entries`);

      let ledgers = [];
      // winning amount is the number of players that week, times winning percentage, divided by winners
      const winnings = players.length * config.goalmine.win_pct / winners.length;

      // loop through goalmine entries
      for (let x = 0; x < players.length; x++) {
        ledgers.push(models.Ledger.create({
          user_id: players[x],
          amount: -1,
          description: `Entry for week ${ wid }`
        }));
      }
      logger.info(`Adding Goalmine entry ledgers for week ${ wid }`);
      // loop through goalmine winners
      for (let y = 0; y < winners.length; y++) {
        ledgers.push(models.Ledger.create({
          user_id: winners[y].user_id,
          amount: winnings,
          description: `Winnings for week ${ wid }`
        }));
      }
      logger.info(`Adding Goalmine winner ledgers for week ${ wid }`);
      // finally add the pot
      ledgers.push(models.Ledger.create({
        user_id: 0, // user id 0 is the pot
        amount: players.length * (1 - config.goalmine.win_pct),
        description: `Pot for week ${ wid }`
      }));
      logger.info(`Adding Goalmine pot ledger for week ${ wid }`);

      const money = await Promise.all(ledgers);
      return money && complete;

    } catch (e) {
      logger.error(e);
      return null;
    }


  };

  // current week is the earliest week that hasn't been finalised
  model.current = async () => {

    const models = require('.');

    try {
      const week = await models.Week.findOne({
        where: { status: 0 },
        attributes: ['id', 'start', 'status'],
        order: [['start', 'ASC']],
        raw: true
      });
      return week;
    } catch (e) {
      logger.error('could not retrieve current week');
      return null;
    }

  };

  // check if a week is ready to be finalised
  model.checkComplete = async week => {

    if (!week) return false;
    const models = require('.');

    // a week is ready to be finalised if there are no matches without a result _and_ week isn't already completed
    let promises = [];
    promises.push(models.Week.findById(week));
    promises.push(models.Match.findAll({
      attributes: ['id'],
      where: { week_id: week}
    }));
    promises.push(models.Match.findAll({
      attributes: ['id'],
      where: { week_id: week, result: null }
    }));

    // return values: 1 - ready to be completed, 0 - not ready, null - could not check or invalid week
    try {
      const [weekDone, existingMatches, outstandingMatches] = await Promise.all(promises);
      return weekDone && weekDone.status == 0 && outstandingMatches.length == 0 && existingMatches.length != 0;
    } catch (e) {
      logger.error('could not check if week is complete');
      return null;
    }

  };

  return model;

};

module.exports = Week;
