'use strict';

const models  = require('../models'),
      utils   = require('../utils'),
      logger  = require('winston'),
      moment  = require('moment');

const controller = {

  // get the prediction table for given week
  get_id: [utils.isAuthenticated, async (req, res, id) => {

    try {
      if (!req.user) throw new Error('no valid user');
      let promises = [];

      promises.push(models.Prediction.table(id, req.user.username));
      promises.push(models.Week.findById(id));
      const [table, week] = await Promise.all(promises);

      if (table == null) throw new Error('no table');
      const dl = moment(week.start).startOf('day').add(12, 'h'),
            expired = moment().isAfter(dl) || week.status;

      res.render('predictions/view', {
        title: 'Predictions',
        week: id,
        players: table.players,
        table: table.table,
        totals: table.totals,
        expired: expired,
        scripts: ['/js/prededit.js']
      });
    } catch (e) {
      if (e.message != 'no table') logger.error(e);
      res.status(404).render('errors/404');
    }

  }],

  // handle an ajax prediction update
  post_update: [utils.isAuthenticated, async (req, res) => {

    try {
      if (!utils.validScore(req.body.pred) || !req.body.uid || !req.body.mid) throw new Error('missing parameters');

      let save = {
        match_id: req.body.mid,
        user_id: req.body.uid,
        pred: req.body.pred
      };
      const pred = await models.Prediction.findById(req.body.pid);
      const r = pred ? await pred.update(save) : await models.Prediction.create(save);
      res.status(200).send({ id: r.id });

    } catch (e) {
      let errs = [];
      if (!req.body.pred) errs.push('prediction');
      if (!req.body.uid) errs.push('user');
      if (!req.body.mid) errs.push('match');
      logger.error(e);
      res.status(400).send({ msg: e.name, params: errs });
    }

  }],

  // handle an ajax joker update
  post_joker: [utils.isAuthenticated, async (req, res) => {
    // { uid: xxxxx, week: xxx, mid: xxxx }

    try {
      if (!req.body.uid || !req.body.week || !req.body.mid) throw new Error('missing parameters');
      // try to find any existing joker for that match and user
      const old = await models.Prediction.findOne({
        attributes: ['id', 'joker'],
        where: { user_id: req.body.uid, joker: 1 },
        include: {
          model: models.Match,
          attributes: ['week_id'],
          where: { week_id: req.body.week }
        }
      });
      if (old) {
        old.update({ joker: 0 });
      }
      const upd = await models.Prediction.update({
        joker: 1
      }, {
        where: { match_id: req.body.mid, user_id: req.body.uid }
      });
      res.send(upd);

    } catch (e) {
      res.status(400).send({ msg: e.message });
    }

  }],

  get_counts: [utils.isAjax, async (req, res) => {
    try {
      if (!req.user) throw new Error('no user');
      res.send(await models.Prediction.predCount(req.user.id));
    } catch (e) {
      res.status(403).send({ err: e.message });
    }

  }]

};

module.exports = controller;
