'use strict';

const models  = require('../models'),
      utils   = require('../utils'),
      logger  = require('winston'),
      folder  = 'admin';

const controller = {

  get_index: [utils.isAdmin, async (req, res) => {

    try {
      const out = await models.Match.outstanding();
      res.render(`${ folder }/index`, {
        title: 'Goalmine Admin',
        outstanding: out,
        scripts: ['/js/admin.js'],
        debug: JSON.stringify(out, null, 2)
      });
    } catch (e) {
      logger.error(e);
    }
  }],

  post_match_update: [utils.isAjax, async (req, res) => {

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
      const upd = match.update({
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

  }]
};

module.exports = controller;
