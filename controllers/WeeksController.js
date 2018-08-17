'use strict';

const models  = require('../models'),
      config  = require('../utils/config'),
      Op      = require('sequelize').Op,
      utils   = require('../utils'),
      logger  = require('winston'),
      moment  = require('moment');

const controller = {

  get_index: async (req, res) => {

    try {
      const weeks = await models.Week.findAll({
        attributes: ['id', 'start', 'status'],
        include: {
          model: models.Match,
          attributes: [[models.sequelize.fn('COUNT', models.sequelize.col('date')), 'count']]
        },
        group: ['id'],
        where: { id: { [Op.gte]: config.goalmine.start_week } },
        order: [['id', 'desc']],
        raw: true
      });
      weeks.map(week => {
        week.end = moment(week.start).add(6, 'days').format('ddd DD MMM');
        week.start = moment(week.start).format('ddd DD MMM');
        week.matches = week['matches.count'];
        if (week.status == 1) {
          week.label = 'Complete';
        } else if (week['matches.count'] == 0) {
          week.label = 'Not available';
        } else {
          week.label = 'Available';
        }
      });
      res.render('weeks/index', {
        title: 'Weeks',
        data: weeks,
        debug: JSON.stringify(weeks, null, 2)
      });
    } catch (e) {
      logger.error(e);
      res.status(500).render('errors/500');
    }

  },

  get_id: async (req, res, id) => {

    const promises = [];
    promises.push(models.Week.findById(id));
    promises.push(models.Week.checkComplete(id));
    promises.push(models.Match.findAll({
      where: { week_id: id },
      attributes: ['id', 'date', 'result', 'game'],
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
      }]
    }));

    const [week, comp, matches] = await Promise.all(promises);

    if (week) {
      matches.map(m => {
        m.fdate = moment(m.date).format('ddd DD MMM');
        m.fixture = [m.TeamA.name, m.TeamB.name].join(' v ');
        m.goalmine = (m.game & 1) != 0;
        m.tipping = (m.game & 2) != 0;
        m.killer = (m.game & 4) != 0;
      });
      res.render('weeks/view', {
        title: `Week ${ week.id }`,
        week: week,
        matches: matches,
        complete: comp
      });
    } else {
      res.status(404).render('errors/404');
    }
  },

  get_current: async (req, res) => {

    res.send(await models.Week.current());

  },

  // show list of games to edit/delete, plus add match form (uses match/add template)
  get_edit_id: [utils.isAdmin, async (req, res, id) => {

    try {
      const wk = await models.Week.findById(id);
      if (wk == null) throw new Error('invalid week');
      if (wk.status == 1) throw new Error('week already completed');

      let dates = [];
      for (let x = 0; x < 7; x++) {
        dates.push({
          id: moment(wk.start).add(x, 'd').format('YYYY-MM-DD'),
          date: moment(wk.start).add(x, 'd').format('dddd, D MMM')
        });
      }
      const matches = await models.Match.findAll({
        where: { week_id: id },
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
          attributes: ['id', 'name', 'country']
        }, {
          model: models.Bet,
          attributes: ['id']
        }, {
          model: models.Prediction,
          attributes: ['id']
        }]
      });

      let gm = 0, tp = 0, gotw = false;
      matches.map(m => {
        m.fdate = moment(m.date).format('ddd DD MMM');
        if ((m.game & 2) != 0) {
          tp++;
          m.tipping = true;
        }
        if ((m.game & 1) != 0) {
          gm++;
          m.goalmine = true;
        }
        if (m.gotw) gotw = true;
      });
      if (gm == 12) {
        req.flash('info', 'There are already 12 goalmine matches this week. You will need to delete one before adding a new match');
      }
      if (tp == 10) {
        req.flash('info', 'There are already 10 tipping matches this week. Are you sure you want to add another?');
      }
      res.render('matches/add', {
        title: 'Add Match',
        week: wk.id,
        matches: matches,
        dates: dates,
        goalmine: (gm == 12),
        gotw: gotw,
        scripts: ['/js/vendor/jquery.easy-autocomplete.min.js', '/js/matchedit.js']
      });

    } catch (e) {
      req.flash('error', e.message);
      res.redirect(`/weeks/${ id }`);
    }



  }],

  // run end of week workflows
  get_complete_id: [utils.isAdmin, async (req, res, id) => {

    try {
      const wk = await models.Week.checkComplete(id);
      if (wk == null) throw new Error(`could not check if week ${ id } was complete`);
      try {
        const fin = await models.Week.finalise(id);
        if (!fin) throw new Error(`Couldn't finalise week ${ id }`);
        req.flash('success', `Week ${ id } has been set as completed`);
      } catch (e) {
        req.flash('error', 'error finalising week');
      }
    } catch (e) {
      logger.error(`Could not check complete status for week ${ id }`);
      req.flash('error', `Couldn't set week ${ id } as completed`);
    } finally {
      res.redirect(`/weeks/${ id }`);
    }

  }]

};

module.exports = controller;
