'use strict';

const models  = require('../models'),
      config  = require('../utils/config');

const controller = {

  get_goalmine: async (req, res) => {
    const uid = req.user ? req.user.id : null;
    const wk = await models.Week.current();
    const standings = await models.Standing.overall(uid, wk.id, false);
    res.render('standings/view', {
      title: 'Standings',
      table: standings,
    });
  },

  get_tipping: async (req, res) => {
    const uid = req.user ? req.user.id : null;
    const wk = await models.Week.current();
    const standings = await models.Place.overall(uid, wk.id, false);
    res.render('places/view', {
      title: 'Standings',
      table: standings
    });
  },

  get_index: async (req, res) => {
    const uid = req.user ? req.user.id : null;
    const wk = await models.Week.current();
    const [tipping, goalmine] = await Promise.all([models.Place.overall(uid, wk.id, false), models.Standing.overall(uid, wk.id, false)]);
    res.render('standings/index', {
      title: 'Current Standings',
      week: Math.max(config.goalmine.league_start, wk.id - 1),
      tipping: tipping,
      goalmine: goalmine,
      debug: JSON.stringify([goalmine, tipping], null, 2)
    });
  }

};

module.exports = controller;
