'use strict';

const moment  = require('moment'),
      logger  = require('winston'),
      utils   = require('../utils');

const Killer = (sequelize, DataTypes) => {

  const model = sequelize.define('killers', {
    id: {
      type: DataTypes.INTEGER(10),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    description: {
      type: DataTypes.STRING(256),
      allowNull: false
    },
    start_week: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    admin_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    complete: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false
    }
  });

  // build a table of killer entries
  model.table = async (kid, uid) => {
    const models = require('.');
    const game = await models.Killer.findById(kid, {
      attributes: ['id', 'description', 'complete'],
      include: [{
        model: models.User,
        attributes: ['id', 'username']
      }, {
        model: models.Kentry,
        attributes: ['round_id', 'week_id', 'user_id', 'match_id', 'pred', 'lives'],
        include: [{
          model: models.Week,
          attributes: ['id', 'start']
        }, {
          model: models.Match,
          attributes: ['id', 'result', 'date'],
          include: [{
            model: models.Team,
            as: 'TeamA',
            attributes: ['id', 'name', 'sname']
          }, {
            model: models.Team,
            as: 'TeamB',
            attributes: ['id', 'name', 'sname']
          }]
        }, {
          model: models.User,
          attributes: ['id', 'username']
        }]
      }]
    });
    let data = { game: {}, rounds: {} };
    data.game = {
      id: game.id,
      desc: game.description,
      organiser: game.user,
      complete: game.complete
    };
    let kentry = null;
    for (let x = 0; x < game.kentries.length; x++) {
      kentry = game.kentries[x];
      if (!(kentry.round_id in data.rounds)) {
        data.rounds[kentry.round_id] = {
          week: kentry.week_id,
          entries: []
        };
      }
      const expired = moment(kentry.week.start) <= moment();
      let pred = '';
      if (kentry.pred == 1) {
        pred = 'Home';
      } else if (kentry.pred == 2) {
        pred = 'Away';
      } else if (kentry.pred == 'X') {
        pred = 'Draw';
      }

      // build the fixture label
      // if no mid, show 'no match entered'
      // if user logged in or after expiry show match
      // else show match entered
      let fixture = '';
      if (kentry.match) {
        fixture = (uid == kentry.user.id || expired) ? [kentry.match.TeamA.name, kentry.match.TeamB.name].join(' v ') : 'match entered';
      } else {
        fixture = 'no match entered';
      }

      // was the prediction right?
      const lost = kentry.match ? (utils.calc(kentry.pred, kentry.match.result, 0) > 0) : false;

      // label for remaining lives
      let livesLeft = '';
      if ((kentry.lives < 2) && lost) {
        livesLeft = '<span>&#9760;</span>';
      } else {
        const heart = '<span>❤️</span>';
        const lostheart = '<span class="lost">🖤</span>';
        livesLeft = lost ? heart.repeat(kentry.lives - 1) + lostheart : heart.repeat(kentry.lives);
      }
      data.rounds[kentry.round_id].entries.push({
        uid: kentry.user.id,
        date: kentry.match ? moment(kentry.match.date).format('YYYY-MM-DD') : '-',
        user: kentry.user.username,
        mid: kentry.match ? kentry.match.id : null,
        fixture: fixture,
        result: kentry.match ? kentry.match.result : '-',
        pred: pred,
        editable: (!expired && (uid == kentry.user.id)),
        lostlife: lost,
        livesLeft: livesLeft
      });
    }
    return data;

  };

  // called when result of a killer match is updated. returns # killer entries updated
  model.updateKiller = async mid => {
    const models = require('.');

    try {
      // get all kller entries for that match
      const kentries = await models.Kentry.findAll({
        where: { match_id: mid },
        include: [{
          model: models.User,
          attributes: ['username', 'email']
        }, {
          model: models.Match,
          attributes: ['id', 'result', 'teama_id', 'teamb_id']
        }]
      });
      // if there's none, return
      if (kentries.length == 0) return 0;
      logger.info(`processing ${ kentries.length } killer entries for match ${ mid }...`);

      // loop through killer entries, checking the result and lives remaining
      let promises = [];
      kentries.map(kentry => {
        let lost = 0;
        let lives = kentry.lives;
        if (!utils.calcKiller(kentry.pred, kentry.match.result)) {
          lives--;
          lost = 1;
        }
        if (lives) {
          // second param is outcome (0 - alive, 1 - alive but lost life)
          promises.push(models.Kentry.update(kentry.id, lost));
        }
      });

      const upds = await Promise.all(promises);
      return upds.length;

    } catch (e) {

      logger.error(`error updating killer. (${ e.message })`);
      return null;

    }

  };

  // return killer data for user uid in game kid
  model.killerEntry = async (kid, uid) => {
    const models = require('.');

    let promises = [];

    try {
      // get the kentry
      promises.push(models.Kentry.findOne({
        where: { user_id: uid, killer_id: kid },
        order: [['round_id', 'DESC']],
        include: [{
          model: models.Week,
          attributes: ['id', 'start']
        } ,{
          model: models.Match,
          attributes: ['id', 'date', 'result'],
          include: [{
              model: models.Team,
              as: 'TeamA',
              attributes: ['id', 'name', 'sname']
            }, {
              model: models.Team,
              as: 'TeamB',
              attributes: ['id', 'name', 'sname']
            }]
        }]
      }));

      // get the played games for user in this killer game
      promises.push(models.Khistory.findAll({
        where: { user_id: uid, killer_id: kid },
        attributes: ['id', 'team_id'],
        include: {
          model: models.Team,
          attributes: ['id', 'name']
        }
      }));

      const [kentry, teams] = await Promise.all(promises);

      // array of dates for edit form
      let dates = [];
      for (let x = 0; x < 7; x++) {
        dates.push({
          id: moment(kentry.week.start).add(x, 'd').format('YYYY-MM-DD'),
          date: moment(kentry.week.start).add(x, 'd').format('dddd, D MMM'),
          sel: kentry.match ? moment(kentry.match.date).diff(moment(kentry.week.start), 'days') == x : false
        });
      }
      return {
        kentry: kentry,
        teams: teams,
        dates: dates
      };

    } catch (e) {

      logger.error(e);
      return null;
    }

  };

  // find any live killer users with no prediction this week
  model.resolveWeek = async wid => {
    const models = require('.');
    logger.info('checking empty predictions for Killer');
    // similar to updateKiller, this adjusts lives and adds a new
    // killer entry for the following week (if appropriate)

    try {
      const empty = await models.Kentry.findAll({
        where: { week_id: wid, pred: null }
      });

      let promises = [];

      empty.map(kentry => {
        let lives = kentry.lives;
        // no prediction so automatically lose a life
        lives--;
        if (lives) {
          promises.push(models.Kentry.update(kentry.id, 1));
          logger.info(`promoting killer entry ${ kentry.id } to next round despite no prediction`);
        }
      });
      const upds = await Promise.all(promises);
      logger.info(`promoted ${ upds.length } killer entries`);
      return upds.length;

    } catch (e) {
      logger.error(e);
      return null;
    }

  };

  model.killersInWeek = async wid => {
    const models = require('.');

    try {
      const killers = await models.Kentry.findAll({
        where: { week_id: wid },
        attributes: ['killer_id'],
        include: {
          model: models.Killer,
          where: { complete: 0 },
          attributes: []
        }
      });

      // return just an array of killer_ids
      return [...new Set(killers.map(({ killer_id }) => killer_id))];

    } catch (e) {

      logger.error(`error in killersInWeek ${ e }`);
      return [];

    }

  };

  // check if there's a winner of a killer game this week
  model.checkWinner = async wid => {

    // this is called when the week is finalised
    const models = require('.');

    const kids = await models.Killer.killersInWeek(wid);
    logger.info('checking Killer winner');

    let ret = 0;
    for (let x = 0; x < kids.length; x++) {
      const kid = kids[x];
      try {
        // list of ids of promoted players
        const list = await models.Kentry.findAll({
          where: { killer_id: kid, week_id: wid + 1 },
          attributes: ['id', 'user_id']
        });
        // current players with one life left
        const current = await models.Kentry.findAll({
          where: { killer_id: kid, week_id: wid, lives: 1 }
        });

        // get array of everyone in next round
        let promoted = [];
        list.map(k => {
          promoted.push(k.user_id);
        });
        logger.info(`killer entries promoted to next round: ${ promoted }`);
        logger.info(list[0].kentry_id);
        let promises = [];
        if (promoted.length == 0) {
          // no-one promoted, so resurrect everyone with 1 life in wid
          current.map(kentry => {
            logger.info(`resurrecting ${ kentry.id }`);
            promises.push(models.Kentry.update(kentry.id, 2));
          });

        } else {
          // some players in next round, so kill players with 1 life not in that list
          current.map(kentry => {
            if (promoted.indexOf(kentry.user_id) == -1) {
              logger.info(`killing ${ kentry.id }`);
              promises.push(models.Kentry.update(kentry.id, 3));
            }
          });
          if (promoted.length == 1) {
            // only one player so winner
            promises.push(models.Kentry.update(list[0].id, 4));
          }
        }

        const updates = await Promise.all(promises);
        ret += updates.length;

      } catch (e) {
        logger.error(`Error in checking killer winners: (${ e.message })`);
        return false;
      }
    }
      return ret;
  };

  return model;
};

module.exports = Killer;
