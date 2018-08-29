'use strict';

const models  = require('../models'),
      utils   = require('../utils'),
      logger  = require('winston'),
      moment  = require('moment');

const controller = {

  // show the edit bets screen
  get_id_edit: [utils.isAuthenticated, async (req, res, id) => {

    try {
      const wk = await models.Week.findById(id),
            uid = req.user ? req.user.id : null,
            dl = moment(wk.start).startOf('day').add(12, 'h'),
            expired = moment().isAfter(dl) || wk.status;

      if (expired) {
        req.flash('error', `The deadline has passed for week ${ id }, you can no longer edit bets`);
        res.redirect(`/weeks/${ id }`);
      } else {
        const matches = await models.Bet.getBets(wk.id, uid);
        res.render('bets/edit', {
          title: 'Edit Bet',
          data: matches,
          expired: expired,
          week: id,
          scripts: ['/js/betedit.js'],
          debug: JSON.stringify(matches, null, 2)
        });
      }
    } catch (e) {
      logger.error(`There was a problem with 'getBets' for week ${ id }. (${ e })`);
      req.flash('error', 'There was an internal error getting the data for this week');
      res.redirect(`/weeks/${ id }`);
    }

  }],

  // show all bets for the given week
  get_id: [utils.isAuthenticated, async (req, res, id) => {

      const user = req.user || {};
      let promises = [];
      try {
        if (isNaN(id)) throw new Error ('invalid week');
        promises.push(models.Bet.table(id, user));
        promises.push(models.Week.findById(id));
        promises.push(models.Place.overall(null, id, true));
        const [bets, wk, overall] = await Promise.all(promises);

        if (bets !== null) {
          let dl = moment(wk.start).startOf('day').add(12, 'h');
          let expired = moment().isAfter(dl) || wk.status;
          res.render('bets/view', {
            title: 'Bets',
            week: id,
            players: bets.players,
            table: bets.table,
            standings: overall,
            expired: expired,
            debug: JSON.stringify([bets, overall], null, 2)
          });
        } else {
          res.status(404).render('errors/404');
        }
      } catch (e) {
        logger.error(e);
        res.status(404).send(e);
      }


  }],

  // handle the form data from editing bets
  post_edit: [utils.isAuthenticated, async (req, res) => {

    const usr = req.user ? req.user.id : 1; // for testing

    try {
      const r = await models.Bet.addEditBets(req.body.bets, usr);
      if (r > 0) {
        req.flash('success', `You updated ${ r } bets`);
      } else {
        req.flash('info', 'No bets were updated');
      }
    } catch (e) {
      logger.error('Could not process bet edit form');
      req.flash('error', 'there was an internal error processing those bets');
    } finally {
      res.redirect(`/bets/${ req.body.week }`);
    }

  }],

  get_counts: [utils.isAjax, async (req, res) => {
    try {
      if (!req.user) throw new Error('no user');
      res.send(await models.Bet.betCount(req.user.id));
    } catch (e) {
      res.status(403).send({ err: e.message });
    }

  }]

};

module.exports = controller;
