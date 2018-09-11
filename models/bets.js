'use strict';

const Bet = (sequelize, DataTypes) => {

  const logger  = require('winston'),
        Op      = require('sequelize').Op,
        config  = require('../utils/config'),
        moment  = require('moment'),
        utils   = require('../utils/'),
        _       = require('lodash/uniqBy');

  const model = sequelize.define('bets', {
    id: {
      type: DataTypes.INTEGER(11),
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
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    prediction: {
      type: DataTypes.ENUM,
      values: ['1','2','X'],
      allowNull: false
    },
    outcome: {
      type: DataTypes.BOOLEAN,
      allowNull: true
    }
  });

  // build the table of bets by player for the given week
  model.table = async (wid, user) => {
    const models = require('.');

    try {
      const matches = await models.Match.findAll({
        where: sequelize.and(
          sequelize.where(sequelize.literal('game & 2'), '!=', 0),
          sequelize.where(sequelize.literal('week_id'), '=', wid)
        ),
        order: [['date', 'ASC']],
        attributes: ['id', 'date', 'week_id', 'odds1', 'odds2', 'oddsX', 'result'],
        include: [{
          model: models.Bet,
          attributes: ['amount', 'prediction', 'outcome'],
          include: {
            model: models.User,
            attributes: ['id', 'username']
          }
        }, {
          model: models.Team,
          as: 'TeamA',
          attributes: ['name', 'sname']
        }, {
          model: models.Team,
          as: 'TeamB',
          attributes: ['name', 'sname']
        }, {
          model: models.Week,
          attributes: ['id', 'start']
        }]
      });
      if (!matches.length) return null;
      const expired = moment(matches[0].week.start) < moment();
      let table   = [],
          players = [];
      // build a array of all players x bets for this week's matches
      matches.forEach(match => {
        match.bets.forEach(bet => {
          players.push({ username: bet.user.username, id: bet.user.id });
        });
      });
      // strip out duplicates and sort to push logged in user to top of list
      let loggedIn = user || { username: null };
      players = _(players, 'id').sort(a => a.username == loggedIn.username ? -1 : 1 );
      // iterate (again) to build the table array for rendering
      matches.forEach(match => {
        let result = null,
            winner = '-';
        if (utils.validScore(match.result)) {
          const [hg, ag] = match.result.split('-');
          if (hg > ag) {
            result = '1'; winner = (match.TeamA.sname || match.TeamA.name);
          } else if (hg < ag) {
            result = '2'; winner = (match.TeamB.sname || match.TeamB.name);
          } else {
            result = 'X'; winner = 'Draw';
          }
        }

        const odds = `odds${ result }`;
        const mid = match.id,
            row = {
              header: {
                id: mid,
                date: moment(match.date).format('ddd DD MMM'),
                fixture: [(match.TeamA.sname || match.TeamA.name), (match.TeamB.sname || match.TeamB.name)].join(' v '),
                outcome: winner,
                return: match.result ? match[odds] : '-'
              },
              bets: []
            };
        for (let x = 0; x < players.length; x++) {
          let scan = match.bets.find(ele => {
            return ele.user.username == players[x].username;
          });
          if (scan === undefined) {
            row.bets.push(null);
          } else {
            if (scan.prediction == '1') {
              scan.prediction = (match.TeamA.sname || match.TeamA.name);
            } else if (scan.prediction == '2') {
              scan.prediction = (match.TeamB.sname || match.TeamB.name);
            } else {
              scan.prediction = 'Draw';
            }
            scan.win = (scan.outcome > 0);
            if (!expired && (scan.user.id != loggedIn.id)) {
              scan.prediction = '???';
              scan.amount = '';
            }
            if (scan.outcome) scan.outcome = scan.outcome.toFixed(2);
            row.bets.push(scan);
          }
        }
        table.push(row);

      });

      return { table: table, players: players };

    } catch (e) {
      logger.error(e.message);
      return null;
    }


  };

  // get all bets for a given week and player
  model.getBets = async (week, uid) => {
    const models = require('.');

    const matches = await models.Match.findAll({
      where: sequelize.and(
        sequelize.where(sequelize.literal('game & 2'), '!=', 0),
        sequelize.where(sequelize.literal('week_id'), '=', week)
      ),
      attributes: ['id', 'date', 'result', 'odds1', 'odds2', 'oddsX'],
      include: [{
        required: false,
        model: models.Bet,
        attributes: ['id', 'amount', 'prediction'],
        where: { user_id: uid }
      }, {
        model: models.Team,
        as: 'TeamA',
        attributes: ['name']
      }, {
        model: models.Team,
        as: 'TeamB',
        attributes: ['name']
      }]
    });

    matches.map(m => {
      m.fdate = moment(m.date).format('ddd DD MMM');
      m.bets = m.bets[0];
      if (m.bets) {
        m.prediction = {
          odds1: m.bets.prediction == '1',
          odds2: m.bets.prediction == '2',
          oddsX: m.bets.prediction == 'X'
        };
      } else {
        m.prediction = {};
      }
    });

    return matches;

  };

  // find all bets for a given user
  model.userBets = async uid => {
    const models = require('.');

    try {
      const results = await models.Bet.findAll({
        where: { user_id: uid },
        attributes: ['outcome'],
        include: [{
          model: models.Match,
          include: [{
            model: models.Team,
            as: 'TeamA',
            attributes: ['name']
          }, {
            model: models.Team,
            as: 'TeamB',
            attributes: ['name']
          }],
          attributes: ['date', 'week_id'],
          where: { week_id: { [Op.gte]: config.goalmine.league_start } },
          order: [['date', 'asc']]
        }]
      });

      let bets = [];
      results.map(item => {
        bets.push({
          week: item.match.week_id,
          fixture: `${ item.match.TeamA.name } v ${ item.match.TeamB.name }`,
          outcome: item.outcome,
          rolling: 0
        });
      });

      let prev = 0;
      bets.map(b => {
        b.rolling = (prev + b.outcome);
        prev = b.rolling;
      });
      return bets;

    } catch (e) {
      logger.error(`error getting user bets (${ e.message })`);
      return null;
    }


  };

  // handle editing of bets
  model.addEditBets = async (data, uid) => {
    const models = require('.');
    let promises = [];

    try {
      for (const item in data) {
        const bet = data[item];
        const obj = {
          user_id: uid,
          match_id: bet.mid,
          prediction: bet.prediction,
          amount: bet.amount
        };
        // either destroy, update or create
        if (bet.status == 'delete') {
          // destroy
          promises.push(models.Bet.destroy({
            where: { id: bet.pid } }
          ).catch(e => {
            logger.error({ mid: bet.mid, err: e });
          }));
        } else {
          if (bet.pid && bet.prediction && bet.mid && bet.amount) {
            // update
            promises.push(models.Bet.update(obj, { where: { id: bet.pid } }).catch(e => { logger.error(e); }));
          } else if (bet.prediction && bet.mid && bet.amount) {
            // create
            promises.push(models.Bet.create(obj).catch(e => { logger.error(e); }));
          }
        }
      }

      const ret = await Promise.all(promises);
      return ret.reduce((a, b) => a + !!b, 0);

    } catch (e) {
      logger.error(`error in addEditBets (${ e.message })`);
      return null;
    }


  };

  model.betCount = async uid => {
    const models = require('.');

    try {
      const week = await models.Week.current();

      const sql = `SELECT 
        M.week_id,
        count(B.prediction) AS bets
        FROM bets B
        JOIN matches M ON M.id = B.match_id AND B.user_id = :uid
        WHERE M.week_id >= :week
        GROUP BY week_id`;
      let bets = await models.sequelize.query(sql, {
        replacements: {
          week: week.id,
          uid: uid },
        type: sequelize.QueryTypes.SELECT
      });

      let html = [];
      for (let itm of bets) {
        let txt = '';
        const pbadge = itm.preds < 3 ? 'danger' : 'success';
        txt = `<li><a href="/bets/${ itm.week_id }">Wk ${ itm.week_id }</a> <span class="badge badge-${ pbadge }">${ itm.bets }</span></li>`;
        html.push(txt);
      }
      return html;

    } catch (e) {
      return null;
    }
  };

  return model;

};

module.exports = Bet;
