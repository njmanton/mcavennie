'use strict';

const models  = require('../models'),
      Op      = require('sequelize').Op,
      utils   = require('../utils'),
      logger  = require('winston'),
      moment  = require('moment');

const controller = {

  // add a new killer game
  get_add: [utils.isAdmin, async (req, res) => {
    let promises = [];
    const now = moment().format('YYYY-MM-DD');

    try {
      // get list of players signed up to killer
      promises.push(models.User.findAll({
        where: models.sequelize.where(models.sequelize.literal('games & 4'), '!=', 0),
        attributes: ['id', 'username']
      }));
      // get the next three (non active) weeks
      promises.push(models.Week.findAll({
        where: { status: 0, start: { [Op.gte]: now } },
        attributes: ['id', 'start'],
        order: [['id', 'ASC']],
        limit: 3
      }));

      const [players, weeks] = await Promise.all(promises);
      weeks.map(wk => {
        wk.fstart = moment(wk.start).format('Do MMM');
      });
      res.render('killers/add', {
        title: 'New Killer game',
        players: players,
        weeks: weeks,
        edit: false,
        debug: JSON.stringify([weeks, players], null, 2)
      });
    } catch (e) {
      req.flash('error', 'could not view that page');
      logger.error(e);
      res.redirect('/killers');
    }

  }],

  post_add: [utils.isAdmin, async (req, res) => {

    let admin = req.user ? req.user : {};
    try {
      const game = await models.Killer.create({
        start_week: req.body.week,
        description: req.body.desc,
        admin_id: admin.id
      });
      let kentries = [];
      for (let x = 0; x < req.body.players.length; x++) {
        kentries.push(models.Kentry.create({
          killer_id: game.id,
          week_id: req.body.week,
          round_id: 1,
          lives: 3,
          user_id: req.body.players[x]
        }).catch(e => { logger.error(e); }));
      }
      const promises = await Promise.all(kentries);
      req.flash('success', `Game created. Go to <code>/killers/${ game.id }</code> to start making predictions`);
      logger.info(`Killer game ${ game.id } with ${ promises.length } players created by ${ admin.username }`);
    } catch (e) {
      req.flash('error', 'internal error creating game');
      logger.error(`internal error creating killer game - ${ e }`);
    }
    res.redirect('/killers/');

  }],

  // show edit form for killer game
  get_edit_id: [utils.isAuthenticated, async (req, res, id) => {

    try {
      const killer = await models.Killer.findById(id, {
        attributes: ['id', 'description', 'start_week'],
        include: [{
          model: models.Week,
          attributes: ['start']
        }, {
          model: models.User,
          attributes: ['id', 'username']
        }, {
          model: models.Kentry,
          attributes: ['user_id'],
          include: {
            model: models.User,
            attributes: ['username']
          }
        }]
      });
      // if game already in week 2, or user isn't organiser/admin, throw error
      if (!req.user) throw new Error('You must be logged in'); // testing only
      if (moment().isAfter(moment(killer.week.start))) throw new Error('Game already started');
      if ((killer.user.id !== req.user.id && req.user.admin == 0)) throw new Error('You must be the organiser or an admin to edit this game');

      const users = await models.User.findAll({
        where: models.sequelize.where(models.sequelize.literal('games & 4'), '!=', 0),
        attributes: ['id', 'username']
      });

      // convert existing players to simple uid array and diff it from eligible users
      const existing = killer.kentries.map(({ user_id }) => user_id);
      const diff = users.filter(itm => !existing.includes(itm.id));

      res.render('killers/edit', {
        title: `Edit Killer ${ id }`,
        kid: id,
        users: killer.kentries,
        available: diff,
        desc: killer.description,
        start: killer.start_week,
        debug: JSON.stringify(killer.kentries, null, 2)
      });
    } catch (e) {
      logger.error(e);
      req.flash('error', e.message);
      res.redirect(`/killers/${ id }`);
    }

  }],

  // handle the posted data from killer edit form
  post_edit_id: [utils.isAuthenticated, async (req, res, id) => {
    // get the new players and add kentry records, update description
    try {
      // update the killer entry
      const killer = await models.Killer.findById(id);
      killer.update({
        description: req.body.desc
      });
      let kentries = [];

      // convert player ids into array (otherwise we iterate over the characters of a singleton value)
      if (!Array.isArray(req.body.players)) req.body.players = [req.body.players];

      // create a kentry record for every added user
      for (let x = 0; x < req.body.players.length; x++) {
        kentries.push(models.Kentry.create({
          killer_id: id,
          week_id: killer.start_week,
          round_id: 1,
          lives: 3,
          user_id: req.body.players[x]
        }).catch(e => { logger.error(e.message); }));
      }
      const promises = await Promise.all(kentries);
      req.flash('success', `Killer game ${ id } edited`);
      logger.info(`Killer game ${ id } edited, adding ${ promises.length } players`);
    } catch (e) {
      req.flash('error', 'internal error editing game');
      logger.error(`internal error editing killer game - ${ e }`);
    } finally {
      res.redirect(`/killers/${ id }`);
    }

  }],

  // show all killer games
  get_index: async (req, res) => {
    // user associated with killer model is the organiser for that game
    let options = {
      order: [['start_week', 'DESC']],
      include: [{
        model: models.User,
        attributes: ['id', 'username']
      }]
    };

    let all = false;
    if (req.query.all === undefined) {
      options.limit = 5;
      all = true;
    }

    try {
      const killers = await models.Killer.findAll(options);
      res.render('killers/index', {
        title: 'Killer games',
        games: killers,
        all: all,
        debug: JSON.stringify([killers, all], null, 2)
      });
    } catch (e) {
      req.flash('error', 'Sorry, could not retrieve list of Killer games');
      logger.error(e);
      res.redirect('/');
    }

  },

  // get an individual killer game
  get_id: [utils.isAuthenticated, async (req, res, id) => {
    // id is the id of the killer game
    let uid = req.user ? req.user.id : 0;

    try {
      let promises = [];
      // get the table of killer entries for that game
      promises.push(models.Killer.table(id, uid));
      // get the data for editing entry
      promises.push(models.Killer.killerEntry(id, uid));

      const [killer, edit] = await Promise.all(promises);
      res.render('killers/view', {
        title: `Killer game ${ killer.game.id }`,
        game: killer.game,
        rounds: killer.rounds,
        edit: edit,
        button: (req.user.admin || req.user.id == killer.game.organiser.id) && !killer.rounds,
        scripts: ['/js/vendor/jquery.easy-autocomplete.min.js', '/js/killeredit.js']
      });
    } catch (e) {
      logger.error(e);
      req.flash('error', 'could not retrieve details for that killer game');
      res.redirect('/killers');
    }

  }],

  // handle the submission from a killer game (adding/editing an (k)entry)
  post_id: [utils.isAuthenticated, async (req, res, id) => {

    try {
      if (req.body.kid == '' || req.body.rid == '' || req.body.wid == '' || req.body.homeId == '' || req.body.awayId == '') throw new Error('missing params');
      // kentry id
      const kyid = req.body.kyid || 0;
      const kentry = await models.Kentry.findById(kyid);
      if (!kentry) throw new Error('could not get Killer entry record');
      let killerMatch = null;

      const currentMatch = await models.Match.findById(req.body.mid, { attributes: ['id', 'game'] });
      const newMatch = await models.Match.findOne({
        where: { teama_id: req.body.homeId, teamb_id: req.body.awayId, week_id: req.body.wid },
        attributes: ['id', 'game']
      });

      // check if currentMatch should be deleted
      // (if it's a killer-only game, and not used in any other kentries)
      if (currentMatch) {
        const only = await models.Kentry.findAll({
          where: { match_id: currentMatch.id }
        });
        if (currentMatch.game == 4 && only.length == 1) {
          // delete currentMatch
          const del = await currentMatch.destroy();
          if (del) logger.info(`match ${ currentMatch.id } has been deleted by kentry update`);
        }
      }

      if (newMatch) {
        killerMatch = await newMatch.update({ game: (newMatch.game | 4) });
        logger.info(`adding match ${ newMatch.id } to kentry ${ kentry.id } (adding killer flag)`);
      } else {
        killerMatch = await models.Match.create({
          date: req.body.date,
          week_id: req.body.wid,
          teama_id: req.body.homeId,
          teamb_id: req.body.awayId,
          league_id: null,
          game: 4
        });
        logger.info(`created new match ${ killerMatch.id } for kentry ${ kentry.id }`);
      }
      // update killer entry
      const upd = await kentry.update({
        match_id: killerMatch.id,
        pred: req.body.pred
      });

      if (!upd) throw new Error('could not update record');

      logger.info(`updated killer entry for user ${ req.user.id }, killer game ${ req.body.kid } round ${ req.body.rid }`);
      req.flash('success', 'updated record');
    } catch (e) {
      logger.error(`error updating killer entry (${ e })`);
      req.flash('error', e.message);
    }

    res.redirect(`/killers/${ id }`);

  }],

  // ajax function to get killer games for logged in user, for sidebar
  get_games: [utils.isAjax, async (req, res) => {

    // TODO work out how to get kentries with a badge indicating lives/prediction made
    try {
      if (!req.user) return null;
      const games = await models.Kentry.findAll({
        where: { user_id: req.user.id },
        attributes: ['killer_id', 'match_id'],
        include: {
          model: models.Killer,
          attributes: [],
          where: { complete: 0 }
        }
      });
      res.send([...new Set(games.map(({ killer_id }) => `<li><a href="/killers/${ killer_id }">Game ${ killer_id }</a></li>`))]);
    } catch (e) {
      res.status(404).send([]);
    }
  }]

};

module.exports = controller;
