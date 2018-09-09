'use strict';

const debug   = require('./config'),
      logger  = require('winston');
      //models  = require('../models');

const points = {
  win: 5,
  correct_difference: 3,
  correct_result: 1,
  joker_penalty: 0
};

const validScore = score => {
  try {
    return !!score.match(/^\d{1,2}-\d{1,2}$/);
  } catch(e) {
    return false;
  }
};

const utils = {

  getTempName: len => {
    var code = '';
    const letters = '234679ACDEFGHJKLMNPQRTUVWXYZ';

    // generate a random code
    for (var i = 0; i < len; i++) {
      var idx = Math.floor(Math.random() * (letters.length - 1));
      code += letters[idx];
    }
    return code;
  },

  // access functions used in routes
  isAjax: (req, res, next) => {
    if (req.xhr || debug.cfg.allowCurlAjax) { //~req.headers.accept.indexOf('json') || debug.cfg.allowCurlAjax) {
      return next();
    } else {
      res.sendStatus(403);
    }
  },

  isAuthenticated: (req, res, next) => {
    try {
      if (req.isAuthenticated() || debug.cfg.allowCurlAuth) {
        return next();
      } else {
        req.session.returnTo = req.url;
        res.redirect('/login');
      }
    } catch (e) {
      logger.error(e);
    }

  },

  isAnon: (req, res, next) => {
    if (req.isAuthenticated() && !debug.cfg.allowCurlAnon) {
      return res.redirect(`/users/${ req.user.id }`);
    }
    return next();
  },

  isAdmin: (req, res, next) => {
    if ((req.isAuthenticated() && req.user.admin == 1) || debug.cfg.allowCurlAdmin) {
      // models.Week.current().then(wk => {
      //   res.locals.curweek = wk.id;
      //   return next();
      // });
      return next();
    } else {
      if (req.isAuthenticated()) {
        req.flash('error', 'must be an admin');
        res.redirect('/home');
      }
      req.session.returnTo = req.url;
      res.redirect('/login');
    }
  },

  validScore: score => {
    return validScore(score);
  },

  // calculate a goalmine score for given rpediction and result
  calc: (pred, result, joker = 0, gotw = 0) => {
    let pg, rg, score = 0;
    let multiplier = (gotw + joker + 1); // score is doubled if joker or gotw (can't be both)
    if (validScore(result) && validScore(pred)) {
      rg = result.split('-');
      pg = pred.split('-');
    } else {
      return score;
    }

    if (pred == result) {
      score = points.win * multiplier;
    } else if ((pg[0] - rg[0]) == (pg[1] - rg[1])) {
      score = points.correct_difference * multiplier;
    } else if (Math.sign(pg[0] - pg[1]) == Math.sign(rg[0] - rg[1])) {
      score = points.correct_result * multiplier;
    } else {
      score = (joker * points.joker_penalty) ;
    }

    return score;

  },

  // scores a killer prediction.
  calcKiller: (pred, result) => {

    // pred is 1,2,'X'. result is actual match result
    try {
      if (!validScore(result)) throw new Error(`${ result } not valid score`);
      if (['1', '2', 'X'].indexOf(pred) == -1) throw new Error(`${ pred } not valid prediction`);
      const [h, a] = result.split('-');
      let outcome = null;
      if (h > a) {
        outcome = 1;
      } else if (h < a) {
        outcome = 2;
      } else {
        outcome = 'X';
      }
      return outcome == pred ? 1 : 0;
    } catch (e) {
      return null;
    }

  }

};

module.exports = utils;
