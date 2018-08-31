'use strict';

const moment  = require('moment'),
      Op      = require('sequelize').Op,
      logger  = require('winston'),
      mail    = require('../mail'),
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
      } else {
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
        const heart = '<span>♥</span>';
        const lostheart = '<span class="lost">♥</span>';
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

  // called when result of a killer match is updated
  model.updateKiller = async mid => {
    const models = require('.');

    try {
      // get all kller entries for that match
      const kentries = await models.Kentry.findAll({
        where: { match_id: mid },
        include: {
          model: models.Match,
          attributes: ['id', 'result']
        }
      });
      // if there's none, return
      if (kentries.length == 0) return null;

      // loop through killer entries, checking the result and lives remaining
      let upd = 0;
      kentries.map(async kentry => {
        let lives = kentry.lives;
        if (!utils.calcKiller(kentry.pred, kentry.match.result)) lives--;
        if (lives) {
          // still alive so send an email
          // TODO email
          // add a new killer entry for next week (if not already one)
          // (this might happen if a result is re-entered)
          const nextWeek = await models.Kentry.findOne({
            where: { user_id: kentry.user_id, round_id: kentry.round_id + 1, week_id: kentry.week_id + 1 }
          });
          const data = {
            killer_id: kentry.killer_id,
            user_id: kentry.user_id,
            round_id: kentry.round_id + 1,
            week_id: kentry.week_id + 1,
            lives: lives
          };
          if (nextWeek) {
            const upd = await nextWeek.update(data);
            if (upd) logger.info(`updated kentry ${ nextWeek.id } due to match ${ mid } result`);
          } else {
            const add = await models.Kentry.create(data);
            if (add) logger.info(`created kentry ${ add.id } due to match ${ mid } result`);
          }
          logger.info(`user ${ kentry.user_id } into round ${ kentry.round_id + 1 } on killer game ${ kentry.killer_id }`);
        } else {
          // dead!
          logger.info(`user ${ kentry.user_id } DEAD in round ${ kentry.round_id } on killer game ${ kentry.killer_id }`);
        }
        upd++;
      });
      return upd;
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

    // similar to updateKiller, this adjusts lives and adds a new
    // killer entry for the following week (if appropriate)

    try {
      const empty = await models.Kentry.findAll({
        where: { week_id: wid, pred: null }
      });

      empty.map(async kentry => {
        let lives = kentry.lives;
        // no prediction so automatically lose a life
        lives--;
        if (lives) {
          // still alive so send an email
          // TODO email
          // add a new killer entry for next week
          // if there was no prediction there won't already be an entry for the following week
          const add = await models.Kentry.create({
            killer_id: kentry.killer_id,
            user_id: kentry.user_id,
            round_id: kentry.round_id + 1,
            week_id: kentry.week_id + 1,
            lives: lives
          });
          if (add) {
            logger.info(`user ${ kentry.user_id } into round ${ kentry.round_id + 1 } on killer game ${ kentry.killer_id }`);
          }
        } else {
          // dead!
          // TODO email
          logger.info(`user ${ kentry.user_id } DEAD in round ${ kentry.round_id } on killer game ${ kentry.killer_id }`);
        }
      });
      return empty.length;

    } catch (e) {
      logger.error(e);
      return null;
    }

  };

  // check if there's a winner of a killer game this week
  model.checkWinner = async wid => {

    const models = require('.');

    try {
      // find all kentries for the following week
      const list = await models.Kentry.findAll({
        where: { week_id: wid + 1 },
        attributes: ['killer_id', [sequelize.fn('COUNT', sequelize.col('lives')), 'players']],
        group: ['killer_id'],
        raw: true
      });

      // filter the entries for given week + 1
      // any games which have a single entry for that week are complete
      const completedGames = [];
      list.filter(i => i.players == 1).map(i => completedGames.push(i.killer_id));
      const killers = await models.Killer.findAll({
        where: { id: { [Op.in]: completedGames }, complete: 0 }
      });

      // loop through any relevant killer games and set as complete
      killers.map(async killer => {
        killer.update({ complete: 1 });
        // find the winners
        let winner = await models.Kentry.findOne({
          where: { week_id: wid + 1, killer_id: killer.id },
          attributes: ['killer_id', 'lives', 'round_id'],
          include: {
            model: models.User,
            attributes: ['id', 'username', 'email']
          }
        });
        // send winner(s) an email
        const template = 'killer_win.hbs',
              subject  = 'Goalmine Killer update',
              context  = {
                name: winner.username,
                killer: winner.killer_id,
                lives: winner.lives,
                round: winner.round_id
              };
        mail.send(winner.email, null, subject, template, context, done => {
          logger.info(done);
        });
        return true;
      });
    } catch (e) {
      logger.error(`Error in checking killer winners: (${ e.message })`);
    }
  };

  return model;
};

module.exports = Killer;
