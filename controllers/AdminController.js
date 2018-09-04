'use strict';

const models  = require('../models'),
      utils   = require('../utils'),
      marked  = require('marked'),
      emojify = require('node-emoji').emojify,
      logger  = require('winston'),
      moment  = require('moment'),
      mail    = require('../mail'),
      folder  = 'admin';

const controller = {

  // show all admin options
  get_pending: [utils.isAdmin, async (req, res) => {

    try {
      const out = await models.Match.outstanding();
      res.render(`${ folder }/pending`, {
        title: 'Goalmine Admin',
        outstanding: out,
        scripts: ['/js/admin.js'],
        debug: JSON.stringify(out, null, 2)
      });
    } catch (e) {
      logger.error(e);
    }
  }],

  get_email: [utils.isAdmin, (req, res) => {
    res.render(`${ folder }/email`, {
      title: 'Send bulk email'
    });
  }],

  // handle a submitted match result
  post_match_update: [utils.isAjax, utils.isAdmin, async (req, res) => {

    const usr = req.user ? req.user.username : 'test',
          mid = req.body.mid,
          result = req.body.result;

    try {
      if (!mid) throw new Error('missing match');
      if (!utils.validScore(req.body.result)) throw new Error('invalid score format');
      const match = await models.Match.findById(mid, { attributes: ['id', 'game'] });
      const [hg, ag] = result.split('-');

      let tipOutcome = null;
      if (hg > ag) {
        tipOutcome = '1';
      } else if (hg < ag) {
        tipOutcome = '2';
      } else {
        tipOutcome = 'X';
      }

      // update the match with the result
      const upd = await match.update({
        result: result
      });

      if (!upd) throw new Error(`could not set result for match ${ mid }`);
      logger.info(`match ${ mid } result set to ${ result } by ${ usr }`);

      // iterate over all predictions for that match and set the points
      const preds = await models.Prediction.findAll({
        where: { match_id: mid },
        include: {
          model: models.Match,
          attributes: ['gotw']
        }
      });

      // now map the individual instances and update them
      preds.map(pred => {
        pred.update({
          points: utils.calc(pred.pred, result, pred.joker, pred.match.gotw)
        });
      });

      // and do the same for tips
      const tips = await models.Bet.findAll({
        where: { match_id: mid },
        include: {
          model: models.Match,
          attributes: ['odds1', 'odds2', 'oddsX', 'result', 'gotw']
        }
      });

      tips.map(tip => {
        const outcome = tip.prediction == tipOutcome ? tip.amount * (tip.match[`odds${ tipOutcome }`] - 1) : -tip.amount;
        tip.update({
          outcome: outcome
        });
      });

      // run all the updates for each game including that match
      let promises = [];
      if (match.game & 1) promises.push(models.Standing.updateTable(mid));
      if (match.game & 2) promises.push(models.Place.updateTable(mid));
      if (match.game & 4) promises.push(models.Killer.updateKiller(mid));

      const updates = await Promise.all(promises);

      res.send({ updated: true, msg: `${ updates.length } game(s) updated` });

    } catch (e) {
      logger.error(`error updating match ${ mid } result (${ e.message })`);
      res.send({ updated: false, msg: e.message });
    }

  }],

  // handle a bulk email
  post_email: [utils.isAdmin, async (req, res) => {

    try {
      if (!req.body.subject || !req.body.body) throw new Error('missing params');

      const template = 'bulk_email.hbs',
            email = 'goalmine-test@goalmine.eu', // TODO replace
            now = moment().format('YYYY-MM-DD'),
            context = {
              from: req.user ? req.user.username : 'Admin',
              body: marked(emojify(req.body.body)),
              date: now
            };

      mail.send(email, null, req.body.subject, template, context, () => {
        logger.info(`sending mail to ${ email }`);
      });
      req.flash('success', 'email has been sent');
    } catch (e) {
      logger.error(`error sending bulk email (${ e.message })`);
      req.flash('error', e.message);
    } finally {
      res.redirect('/admin/email');
    }

  }]
};

module.exports = controller;
