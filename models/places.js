'use strict';

const Place = (sequelize, DataTypes) => {

  const logger   = require('winston'),
        config   = require('../utils/config');

  const model = sequelize.define('places', {
    id: {
      type: DataTypes.INTEGER(10),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    week_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    balance: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    rank: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  });

  // update the tipping table following a match result
  model.updateTable = async mid => {
    const models = require('.');

    try {
      const match = await models.Match.findById(mid, { attributes: ['week_id', 'game'] });
      if ((match.game & 2) == 0) return false;

      const destroy = await models.Place.destroy({ where: { week_id: match.week_id }});
      let promises = [];
      promises.push(models.User.findAll({
        where: sequelize.where(sequelize.literal('games & 2'), '!=', 0),
        attributes: ['id', 'username']
      }));
      promises.push(models.Bet.findAll({
        attributes: ['id', 'outcome', 'user_id'],
        include: {
          model: models.Match,
          attributes: ['id'],
          where: { week_id: match.week_id }
        },
      }));
      let [p, b] = await Promise.all(promises);
      let players = [], player = {};
      p.map(element => {
        player = {
          user_id: element.id,
          balance: 0,
          week_id: match.week_id,
          rank: 0,
          bets: 0
        };
        players.push(player);
      });

      for (let x = 0; x < b.length; x++) {
        let scan = players.find(ele => {
          return ele.user_id == b[x].user_id;
        });
        if (scan !== undefined) {
          scan.balance += b[x].outcome;
          scan.bets++;
        }
      }
      players.sort((a, b) => b.balance - a.balance);

      let row = 0,
          rank = 1,
          prev = null;

      players.map(line => {
        if (line.balance == prev) {
          row++;
        } else {
          rank = ++row;
        }
        prev = line.balance;
        line.rank = rank;
        if (line.bets == 0) {
          line.balance = -100;
        }
        delete line.bets;
      });

      const create = await models.Place.bulkCreate(players);
      logger.info(`updated match ${ mid }, recreating ${ create.length }/${ destroy } places for week ${ match.week_id }`);
      return create;

    } catch (e) {
      logger.error(e);
    }


  };

  model.overall = async (uid = null, wid, single = true) => {
    const models = require('.');

    const start = single ? wid : config.goalmine.league_start,
          end = single ? wid : Math.max(wid - 1, config.goalmine.league_start);
    let sql = 'SELECT U.id, U.username, SUM(P.balance) AS balance FROM places P INNER JOIN users U ON U.id = P.user_id WHERE P.week_id >= :start AND P.week_id <= :end GROUP BY U.id, U.username';
    let promises = [];

    promises.push(models.sequelize.query(sql, {
      replacements: {
        start: start,
        end: end },
      type: sequelize.QueryTypes.SELECT
    }));
    promises.push(models.sequelize.query(sql, {
      replacements: {
        start: start,
        end: end - 1 },
      type: sequelize.QueryTypes.SELECT
    }));

    let [curr, prev] = await Promise.all(promises);
    curr.sort((a, b) => (b.balance - a.balance));
    prev.sort((a, b) => (b.balance - a.balance));

    // calculate the rank of each array
    let row = 0,
    rank = 1,
    prevbal = 0;
    prev.map(line => {
      if (line.balance == prevbal) {
        row++;
      } else {
        rank = ++row;
      }
      prevbal = line.balance;
      line.rank = rank;
    });

    row = 0; rank = 1; prevbal = 0;
    let rowabove = 0;
    curr.map(line => {
      let prevpos = prev.find(ele => {
        return (ele.username == line.username);
      });
      line.prevrank = prevpos ? prevpos.rank : 999;
      if (line.balance == prevbal) {
        row++;
      } else {
        rank = ++row;
      }
      prevbal = line.balance;
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
      if (rowabove > 0 && line.balance < 0) {
        line.breakeven = true;
      }
      rowabove = line.balance;
      line.balance = line.balance.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });
      line.prevbal = prevpos ? prevpos.balance.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' }) : 0;

    });
    return curr;
  };

  // get the total balance and rank for given player
  model.balance = async uid => {
    const models = require('.');

    try {
      const week = await models.Week.current();
      const place = await models.Place.overall(uid, week.id, false);

      return place.filter(ele => ele.id == uid)[0];

    } catch (e) {
      logger.error(e);
      return {};
    }
  };

  return model;

};

module.exports = Place;
