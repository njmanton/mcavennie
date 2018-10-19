'use strict';

const Standing = (sequelize, DataTypes) => {

  const Op      = require('sequelize').Op,
        logger  = require('winston'),
        config  = require('../utils/config');

  const model = sequelize.define('standings', {
    id: {
      type: DataTypes.INTEGER(10),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    match_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    points: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: true,
    }
  });

  model.updateTable = async mid => {

    // this updates the standings table for a week, whenever a match is updated
    // first destroy the current rows for that week, then rebuild it
    const models = require('.');
    const match = await models.Match.findById(mid, { attributes: ['week_id', 'game'] });
    if ((match.game & 1) == 0) return false;

    try {
      const destroy = await models.Standing.destroy({ where: { week_id: match.week_id } });

      const table = await models.Prediction.table(match.week_id);
      let row = 0, rank = 1, prev = 0;
      let rankings = table.players
        .filter(row => row.user != undefined)
        .sort((a, b) => (b.points - a.points));

      rankings.map(line => {
        if (line.points == prev) {
          row++;
        } else {
          rank = ++row;
        }
        prev = line.points;
        line.position = rank;
        line.user_id = line.id;
        delete line.closest;
        delete line.user;
        delete line.total;
        delete line.id;
        line.week_id = match.week_id;
      });
      const create = await models.Standing.bulkCreate(rankings);
      logger.info(`updating match ${ mid } recreated ${ create.length }/${ destroy } standings for week ${ match.week_id }`);
      return create;


    } catch (e) {
      logger.error(`error updating standings: ${ e.message }`);
      return false;
    }

  };

  model.overall = async (uid, wid, single = true) => {

    const models = require('.');

    const start = single ? wid : config.goalmine.league_start;
    const end = single ? wid : Math.max(wid - 1, config.goalmine.league_start);
    let promises = [];

    try {
      promises.push(models.Standing.findAll({
        where: { week_id: { [Op.lte]: end, [Op.gte]: start } },
        attributes: ['week_id', 'points'],
        include: {
          model: models.User,
          attributes: ['id', 'username'],
        },
        order: sequelize.literal('username ASC, points DESC')
      }));

      promises.push(models.Standing.findAll({
        where: { week_id: { [Op.lte]: end - 1, [Op.gte]: start } },
        attributes: ['week_id', 'points'],
        include: {
          model: models.User,
          attributes: ['id', 'username']
        },
        order: sequelize.literal('username ASC, points DESC')
      }));

      let [curr, prev] = await Promise.all(promises);

      const aggregate = arr => {
        let standings = [],
            idx = 0,
            counter = 0,
            user = null;
        for (let x = 0; x < arr.length; x++) {
          let item = arr[x];
          if (item.user.username != user) {
            idx = standings.push({ username: item.user.username, points: 0, games: 0, min: 10000, id: item.user.id });
            counter = 0;
          }
          if (counter++ < 30) standings[idx - 1].points += item.points;
          standings[idx - 1].games++;
          standings[idx - 1].min = item.points;

          user = item.user.username;
        }
        standings.sort((a, b) => { return b.points - a.points; });
        return standings;
      };

      curr = aggregate(curr);
      prev = aggregate(prev);

      // calculate the rank on each array
      let row = 0,
      rank = 1,
      prevpts = 0;

      prev.map(line => {
        if (line.points == prevpts) {
          row++;
        } else {
          rank = ++row;
        }
        prevpts = line.points;
        line.rank = rank;
      });

      row = 0; rank = 1; prevpts = 0;
      curr.map(line => {
        let prevpos = prev.find(ele => {
          return (ele.username == line.username);
        });
        line.prevrank = prevpos ? prevpos.rank : 999;
        if (line.points == prevpts) {
          row++;
        } else {
          rank = ++row;
        }
        prevpts = line.points;
        line.rank = rank;
        line.self = (line.id == uid);
        if (line.prevrank == line.rank) {
          line.symbol = '▶︎';
          line.class = 'level';
        } else if (line.prevrank > line.rank) {
          line.symbol = '▲';
          line.class = 'up';
        } else {
          line.symbol = '▼';
          line.class = 'down';
        }
      });
      return curr;

    } catch (e) {
      logger.error(e);
      return false;
    }

  };

  model.week = async (wid, uid) => {
    const models = require('.');
    const options = {
      where: { week_id: wid },
      attributes: ['week_id', 'user_id', 'points', 'position'],
      include: {
        model: models.User,
        attributes: ['username']
      }
    };
    const table = await models.Standing.findAll(options);
    table.map(item => {
      item.self = item.user_id == uid,
      item.user = item.user.username; });
    return table;

  };

  // get the running total and current rank for given player
  model.balance = async uid => {
    const models = require('.');

    try {
      const week = await models.Week.current();
      const table = await models.Standing.overall(uid, week.id, false);
      return table.filter(ele => ele.id == uid)[0];

    } catch (e) {
      return null;
    }

  };

  return model;
};

module.exports = Standing;
