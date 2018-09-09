'use strict';

const Kentry = (sequelize, DataTypes) => {

  const logger  = require('winston'),
        mail    = require('../mail');

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

  // update a specific killer entry with outcome
  model.update = async (kyid, code) => {
    const models = require('.');

    // array of possible outcomes
    const outcomes = [{
      // right result, through to next week
      template: 'killer_alive.hbs',
      lost: 0
    }, {
      // wrong result, but still alive and through to next week
      template: 'killer_alive.hbs',
      lost: 1
    }, {
      // wrong result and dead, but resurrected and through to next week
      template: 'killer_resurrected.hbs',
      lost: 0
    }, {
      // dead, and not coming back
      template: 'killer_dead.hbs',
      lost: 0
    }, {
      // last man standing
      template: 'killer_win.hbs',
      lost: 0
    }];

    const outcome = outcomes[code];
    logger.info(`updating killer entry ${ kyid } with code ${ code }`);
    try {

      // get the killer entry
      const kentry = await models.Kentry.findById(kyid, {
        include: [{
          model: models.User,
          attributes: ['id', 'username', 'email']
        }, {
          model: models.Match,
          attributes: ['id', 'result', 'teama_id', 'teamb_id'],
          include: [{
            model: models.Team,
            as: 'TeamA',
            attributes: ['name']
          }, {
            model: models.Team,
            as: 'TeamB',
            attributes: ['name']
          }]
        }],
        attributes: ['id', 'lives', 'killer_id', 'round_id', 'week_id', 'match_id']
      });

      if (kentry.length == 0) return false;

      const subject = `killer game ${ kentry.killer_id } update`,
            context = {
              username: kentry.user.username,
              lives: '❤️'.repeat(kentry.lives - outcome.lost),
              lost: outcome.lost,
              kid: kentry.killer_id,
              rid: kentry.round_id + 1
            };
      if (code < 3) {
        // through to next week
        // first see if an entry exists (e.g. if a result has been re-entered)
        const nextWeek = await models.Kentry.findOne({
          where: { week_id: kentry.week_id + 1, killer_id: kentry.killer_id, user_id: kentry.user.id }
        });
        const data = {
          killer_id: kentry.killer_id,
          user_id: kentry.user.id,
          round_id: kentry.round_id + 1,
          week_id: kentry.week_id + 1,
          lives: kentry.lives - outcome.lost
        };
        if (nextWeek) {
          const upd = await nextWeek.update(data);
          if (upd) logger.info(`updated kentry ${ nextWeek.id } due to match ${ kentry.match_id } result`);
        } else {
          const add = await models.Kentry.create(data);
          if (add) logger.info(`created kentry ${ add.id } due to match ${ kentry.match_id } result`);
        }

        //finally add 'used' teams to Khistory
        if (!nextWeek && kentry.match) {
          let promises = [];
          promises.push(models.Khistory.create({ user_id: kentry.user.id, killer_id: kentry.killer_id, team_id: kentry.match.teama_id}).catch(e => { logger.info(`could not add to KHistory table (${ e.message })`); }));
          promises.push(models.Khistory.create({ user_id: kentry.user.id, killer_id: kentry.killer_id, team_id: kentry.match.teamb_id}).catch(e => { logger.info(`could not add to KHistory table (${ e.message })`); }));
          const histories = await Promise.all(promises);
          logger.info(`${ histories.length } teams [${ [kentry.match.teama_id, kentry.match.teamb_id] }] have been added to the killer history for user ${ kentry.user.id } and game ${ kentry.killer_id }`);
          context.teama = kentry.match.TeamA.name;
          context.teamb = kentry.match.TeamB.name;
        }

      }
      mail.send(kentry.user.email, null, subject, outcome.template, context, res => {
        logger.info(res);
      });
      return true;

    } catch (e) {
      logger.error(`could not update kentry ${ kyid } with outcome ${ code } (${ e })`);
      return false;
    }

  };

  return model;

};

module.exports = Kentry;
