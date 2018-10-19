'use strict';

const models  = require('../models'),
      utils   = require('../utils'),
      Op      = require('sequelize').Op,
      logger  = require('winston'),
      moment  = require('moment');

const processEditAdd = async body => {
  let game = 0;
  if (body.goalmine == 'on') game++;
  if (body.tipping == 'on') game += 2;

  let save = {
    date: body.date,
    week_id: body.week,
    league_id: body.leagueId,
    teama_id: body.homeId,
    teamb_id: body.awayId,
    game: game,
    gotw: body.gotw == 'on',
    odds1: body.odds1,
    odds2: body.odds2,
    oddsX: body.oddsX,
  };

  const match = await models.Match.findById(body.mid, { attributes: ['id'] });
  if (match) {
    return match.update(save);
  } else {
    return models.Match.create(save);
  }

};

const controller = {

  get_duplicate: [utils.isAjax, async (req, res) => {
    // check whether match is a duplicate, i.e. same teams and week
    // request = ta, tb, wk
    try {
      const match = await models.Match.findOne({
        attributes: ['id'],
        where: { teama_id: req.query.ta, teamb_id: req.query.tb, week_id: req.query.wk }
      });
      res.send(!!match);
    } catch (e) {
      res.send(e);
    }

  }],

  get_index: async (req, res) => {

    const matches = await models.Match.findAll({
      where: [{ teama_id: { [Op.ne]: null } }, { teamb_id: { [Op.ne]: null } }],
      attributes: ['id', 'result', 'date', 'week_id'],
      include: [{
        model: models.Team,
        as: 'TeamA',
        attributes: ['id', 'name', 'sname']
      }, {
        model: models.Team,
        as: 'TeamB',
        attributes: ['id', 'name', 'sname']
      }, {
        model: models.League,
        attributes: ['id', 'name', 'country']
      }],
    });

    res.render('matches/index', {
      title: 'All Matches',
      matches: matches
    });

  },

  get_id: async (req, res, id) => {

    try {
      const match = await models.Match.findOne({
        where: { id: id },
        attributes: ['id', 'week_id', 'date', 'odds1', 'odds2', 'oddsX', 'gotw', 'result'],
        include: [{
          model: models.Team,
          as: 'TeamA',
          attributes: ['id', 'name', 'sname']
        }, {
          model: models.Team,
          as: 'TeamB',
          attributes: ['id', 'name', 'sname']
        }, {
          model: models.League,
          attributes: ['id', 'name', 'country']
        }, {
          model: models.Bet,
          attributes: ['id', 'amount', 'prediction', 'outcome'],
          include: {
            model: models.User,
            attributes: ['id', 'username']
          }
        }, {
          model: models.Prediction,
          attributes: ['id', 'pred', 'joker', 'points'],
          include: {
            model: models.User,
            attributes: ['id', 'username']
          }
        }],
      });
      if (!match) throw new Error('match not found');
      const goals = match.result ? match.result.split('-') : ['-', '-'];

      match.bets.map(bet => {
        bet.sign = (bet.outcome > 0);
        bet.outcome = bet.outcome.toLocaleString('en-GB', { style: 'currency', currency: 'GBP'});
        bet.prediction = bet.prediction == 1 ? 'Home' : bet.prediction == 2 ? 'Away' : 'Draw';
      });

      match.fdate = moment(match.date).format('ddd DD MMM');
      res.render('matches/view', {
        title: `${ match.TeamA.name } v ${ match.TeamB.name }`,
        data: match,
        result: match.result || 'v',
        editable: req.user && req.user.admin && match.predictions.length == 0 && match.bets.length == 0,
        goals: goals,
        debug: JSON.stringify([match, goals], null, 2)
      });

    } catch (e) {
      if (e.message == 'match not found') {
        res.status(404).render('errors/404');
      } else {
        req.flash('error', e.message);
        logger.error(e);
        res.redirect('/');
      }
    }

  },

  // removes a match from db
  delete_id: [utils.isAdmin, async (req, res, id) => {
    let usr = req.user ? req.user.username : 'unknown';
    let bets = await models.Bet.findAll({
      where: { match_id: id },
      attributes: ['id']
    }),
    preds = await models.Prediction.findAll({
      where: { match_id: id },
      attributes: ['id']
    });

    // matches shouldn't be deleted if they have associated bets/predictions
    // this is checked client-side, but just to be sure
    if (bets.length || preds.length) {
      logger.error(`tried to delete match: ${ id } but predictions/bets exist`);
      res.status(409).send({ deleted: false, msg: `Cannot delete Match ${ id }. There are associated bets/predictions.` });
    } else {
      models.Match.destroy({
        where: { id: id }
      }).then(() => {
        logger.info(`match: ${ id } deleted by (${ usr })`);
        res.status(200).send({ deleted: true, msg: `Match ${ id } deleted` });
      }).catch(e => {
        logger.error(`Couldn't delete match ${ id } (${ e })`);
        res.status(400).send({ deleted: false, msg: `Db error deleting match ${ id }` });
      });
    }

  }],

  get_edit_id: [utils.isAdmin, async (req, res, id) => {

    let wk = {};
    try {
      const match = await models.Match.findById(id, {
        attributes: ['id', 'date', 'week_id', 'gotw', 'odds1', 'odds2', 'oddsX', 'game'],
        include: [{
          model: models.Week,
          attributes: ['id', 'status', 'start']
        }, {
          model: models.Team,
          as: 'TeamA',
          attributes: ['id', 'name']
        }, {
          model: models.Team,
          as: 'TeamB',
          attributes: ['id', 'name']
        }, {
          model: models.League,
          attributes: ['id', 'name']
        }]
      });
      if (!match) throw new Error('match not found');
      wk = match.week;
      let dates = [];

      for (let x = 0; x < 7; x++) {
        dates.push({
          id: moment(wk.start).add(x, 'd').format('YYYY-MM-DD'),
          date: moment(wk.start).add(x, 'd').format('dddd, D MMM')
        });
      }
      let gm = match.game;
      match.game = {};
      if ((gm & 1) != 0) {
        match.game.goalmine = true;
      }
      if ((gm & 2) != 0) {
        match.game.tipping = true;
      }
      if ((gm & 4) != 0) {
        match.game.killer = true;
      }
      const matches = await models.Match.findAll({
        where: { week_id: wk.id },
        attributes: ['id', 'game', 'date', 'gotw'],
        include: [{
          model: models.Team,
          as: 'TeamA',
          attributes: ['id', 'name']
        }, {
          model: models.Team,
          as: 'TeamB',
          attributes: ['id', 'name']
        }, {
          model: models.League,
          attributes: ['id', 'name']
        }, {
          model: models.Bet,
          attributes: ['id']
        }, {
          model: models.Prediction,
          attributes: ['id']
        }]
      });

      let goalmine = 0, tp = 0;
      matches.map(m => {
        if (m.id == id) m.edit = true;
        m.fdate = moment(m.date).format('ddd DD MMM');
        if ((m.game & 2) != 0) {
          tp++;
          m.tipping = true;
        }
        if ((m.game & 1) != 0) {
          goalmine++;
          m.goalmine = true;
        }
        if (m.gotw && (m.id != match.id)) m.gotw = true;
      });
      if (goalmine == 12) {
        req.flash('info', 'There are already 12 goalmine matches this week. You will need to delete one before adding a new match');
      }

      res.render('matches/add', {
        title: 'Edit Match',
        week: wk.id,
        edit: match,
        matches: matches,
        dates: dates,
        goalmine: (goalmine == 12),
        tipping: tp,
        scripts: ['/js/vendor/jquery.easy-autocomplete.min.js', '/js/matchedit.js']
      });

    } catch (e) {
      logger.error(`match/get_edit_id (${ e })`);
      req.flash('error', e.message);
      res.redirect(`/weeks/${ wk.id }`);
    }

  }],

  post_edit: [utils.isAdmin, async (req, res) => {

    const usr = req.user ? req.user.username : '(unknown)';

    try {
      if (req.body.homeId == '' || req.body.awayId == '' || req.body.leagueId == '' || req.body.week == '') throw new Error('missing parameters');
      if (req.body.tipping == 'on' && (req.body.odds1 == '' || req.body.odds2 == '' || req.body.oddsX == '')) throw new Error('Tipping matches must have all three odds');

      const action = await processEditAdd(req.body);
      logger.info(`Match ${ action.id } edited by ${ usr }`);
      req.flash('success', 'Match edited!');
    } catch (e) {
      if (e.name == 'SequelizeUniqueConstraintError') {
        req.flash('error', 'That match already exists for this week');
      } else {
        req.flash('error', e.message);
      }
    } finally {
      res.redirect(`/weeks/edit/${ req.body.week }`);
    }

  }],

  post_add: [utils.isAdmin, async (req, res) => {

    let redir = `/weeks/edit/${ req.body.week }`;
    let usr = req.user ? req.user.username : '(unknown)';

    try {
      if (req.body.homeId == '' || req.body.awayId == '' || req.body.leagueId == '' || req.body.week == '') throw new Error('missing parameters');
      if (req.body.tipping == 'on' && (req.body.odds1 == '' || req.body.odds2 == '' || req.body.oddsX == '')) throw new Error('Tipping matches must have all three odds');

      const action = await processEditAdd(req.body);
      logger.info(`Match ${ action.id } created by ${ usr }`);
      req.flash('success', 'Match created!');
    } catch (e) {
      const err = (e.name == 'SequelizeUniqueConstraintError') ? 'That match already exists for this week' : e.message;
      req.flash('error', err);
    } finally {
      res.redirect(redir);
    }

  }],

};

module.exports = controller;
