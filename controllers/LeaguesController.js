'use strict';

const models  = require('../models'),
      Op      = require('sequelize').Op,
      moment  = require('moment'),
      logger  = require('winston'),
      utils   = require('../utils');

const controller = {

  get_index: async (req, res) => {

    try {
      const leagues = await models.League.findAll({
        attributes: ['id', 'name', 'country', [models.sequelize.fn('COUNT', models.sequelize.col('matches.id')), 'cnt']],
        include: {
          model: models.Match,
          attributes: []
        },
        group: ['id', 'name', 'country'],
        order: models.sequelize.literal('cnt DESC'),
        raw: true
      });

      if (req.query.json === undefined) {
        res.render('leagues/index', {
          title: 'All Leagues',
          leagues: leagues,
          debug: JSON.stringify(leagues, null, 2)
        });
      } else {
        res.send(leagues);
      }
    } catch (e) {
      res.send(e.message);
    }


  },

  get_id: async (req, res, id) => {

    let league = await models.League.findById(id, { attributes: ['id', 'name', 'country'] }),
        matches = await models.Match.findAll({
          where: { league_id: id },
          attributes: ['id', 'date', 'week_id', 'result', 'game', 'gotw'],
          order: [['date', 'DESC']],
          include: [{
            model: models.Team,
            as: 'TeamA',
            attributes: ['id', 'name']
          }, {
            model: models.Team,
            as: 'TeamB',
            attributes: ['id', 'name']
          }]
        });

        matches.map(m => {
          m.fdate = moment(m.date).format('ddd DD MMM');
          m.fixture = `${ m.TeamA.name } v ${ m.TeamB.name }`;
        });
        if (league) {
          res.render('leagues/view', {
            title: league.name,
            league: league,
            matches: matches
          });
        } else {
          res.status(404).render('errors/404');
        }
  },

  get_add: [utils.isAdmin, (req, res) => {
    res.render('leagues/add', {
      title: 'Add League',
      scripts: ['/js/vendor/jquery.easy-autocomplete.min.js', '/js/auto.js']
    });
  }],

  post_add: [utils.isAdmin, async (req, res) => {

    let name = req.body.league,
        usr = req.user ? req.user.username : '(unknown)',
        cty = req.body.country || null;

    try {
      const league = await models.League.create({ name: name, country: cty });
      req.flash('success', `League ${ league.name } has been added to the database`);
      logger.info(`${ league.name } added to list of leagues (${ usr })`);
    } catch (e) {
      if (e) {
        if (e.name == 'SequelizeUniqueConstraintError') {
          req.flash('error', `Sorry, league names must be unique. '${ name }' already exists in the database`);
        } else {
          req.flash('error', 'Sorry, that league could not be saved');
        }
        logger.error(`Couldn't add ${ name } to Leagues (${ usr }) (${ e })`);
      }
    } finally {
      res.redirect(req.url);
    }

  }],

  delete_id: [utils.isAdmin, async (req, res, id) => {

    let usr = req.user ? req.user.username : '(unknown)';

    const league = await models.League.findById(id, {
      attributes: ['id', 'name'],
      include: {
        model: models.Match,
        attributes: ['id']
      }
    });
    if (league) {
      if (league.matches.length) {
        res.status(409).send({ deleted: false, msg: `Cannot delete ${ league.name } (league id ${ league.id }). There are associated matches` });
      } else {
        league.destroy().then(() => {
          logger.info(`${ league.name } (league id: ${ league.id }) deleted by ${ usr }`);
          res.status(200).send({ deleted: true, msg: `${ league.name } (league id: ${ league.id }) deleted.` });
        }).catch(e => {
          logger.error(`Error deleting league - ${ e }`);
          res.status(500).send({ deleted: false, msg: `Db error deleting ${ league.name } (league id: ${ league.id } - error: ${ e }`});
        });
      }
    } else {
      res.status(200).send({ deleted: false, msg: `League ${ id } not deleted. Doesn't exist.` });
    }


  }],

  get_available_name: [utils.isAjax, async (req, res, name) => {
    const league = await models.League.findOne({ where: { name: name } });
    res.send(!league);
  }],

  get_find_name: [utils.isAjax, async (req, res, name) => {
    const leagues = await models.League.findAll({ where: { name: { [Op.like]: `%${ name }%` } }, attributes: ['id', 'name', 'country'] });
    res.send(leagues);
  }]

};

module.exports = controller;
