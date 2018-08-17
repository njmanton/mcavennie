'use strict';

const models  = require('../models'),
      Op      = require('sequelize').Op,
      utils   = require('../utils'),
      logger  = require('winston'),
      folder  = 'teams',
      moment  = require('moment');

const controller = {

  get_index: async (req, res) => {

    try {
      const teams = await models.Team.findAll({
        attributes: ['id', 'name', 'country'],
        raw: true
      });
      res.render(`${ folder }/index`, {
        title: 'All Teams',
        teams: teams
      });
    } catch (e) {
      logger.error(`Error getting list of teams (${ e })`);
      res.status(500).render('errors/500');
    }

  },

  get_id: async (req, res, id) => {

    try {
      let team = await models.Team.findById(id),
          matches = await models.Match.findAll({
            where: { [Op.or]: [{ teama_id: id }, { teamb_id: id }] },
            attributes: ['id', 'result', 'date', 'week_id'],
            order: [['date', 'DESC']],
            include: [{
              model: models.Team,
              as: 'TeamA',
              attributes: ['id', 'name', 'sname', 'country']
            }, {
              model: models.Team,
              as: 'TeamB',
              attributes: ['id', 'name', 'sname', 'country']
            }, {
              model: models.League,
              attributes: ['id', 'name', 'country']
            }]
          });
          if (!team) throw new Error('invalid team');
          let games = [];
          for (var x = 0; x < matches.length; x++) {
            let match = matches[x],
                result = null,
                home = (match.TeamA && match.TeamA.id == id);

            if (match.result) {
              result = (home) ? match.result : match.result.split('-').reverse().join('-');
            }

            let oppo = (home) ? { id: match.TeamB.id, name: match.TeamB.name, country: match.TeamB.country } : { id: match.TeamA.id, name: match.TeamA.name, country: match.TeamA.country };
            let league = (match.league) ? { id: match.league.id, name: match.league.name, country: match.league.country } : { id: null, name: null, country: null };
            games.push({
              id: match.id,
              week: match.week_id,
              date: moment(match.date).format('DD MMM YY'),
              opponent: oppo,
              result: result || '-',
              league: league
            });
          }
          if (req.query.json === undefined) {
            res.render('teams/view', {
              title: team.name,
              team: team,
              matches: games
            });
          } else {
            res.send([team, games]);
          }
    } catch (e) {
      logger.error(`error retrieving team id: ${ id }. Error was '${ e }'`);
      res.status(404).render('errors/404');
    }

  },

  get_add: [utils.isAdmin, (req, res) => {
    res.render(`${ folder }/add`, {
      title: 'Add Team',
      scripts: ['/js/vendor/jquery.easy-autocomplete.min.js', '/js/auto.js']
    });
  }],

  // process a new team form
  post_add: [utils.isAdmin, async (req, res) => {
    let team = req.body.team,
        usr = req.user ? req.user.username : '(unknown)',
        cty = req.body.country || null;

    try {
      const newTeam = await models.Team.create({ name: team, country: cty });
      req.flash('success', `Team ${ newTeam.name } has been created`);
      logger.info(`${ team } added to list of teams by ${ usr }`);
    } catch (e) {
      if (e.name == 'SequelizeUniqueConstraintError') {
        req.flash('error', `Sorry, team names must be unique. '${ team }' already exists in the  database`);
      } else {
        req.flash('error', 'Sorry, that team could not be saved in the  database');
      }
      logger.error(`Couldn't add ${ team } to Teams - by ${ usr }`);
    } finally {
      res.redirect(req.url);
    }

  }],

  // process a team delete request
  delete_id: [utils.isAdmin, async (req, res, id) => {

    let usr = req.user ? req.user.username : '(unknown)';

    const team = await models.Team.findById(id, { attributes: ['id', 'name']});
    if (!team) {
      res.status(200).send({
        deleted: false,
        msg: `Team ${ id } not deleted. Doesn't exist.`
      });
    } else {
      const matches = await models.Match.findAll({
        where: { [Op.or]: [{ teama_id: team.id }, { teamb_id: team.id }] },
        attributes: ['id']
      });
      if (matches.length) {
        res.status(409).send({
          deleted: false,
          msg: `Cannot delete ${ team.name } (${ team.id }). There are associated matches`
        });
      } else {
        team.destroy().then(() => {
          logger.info(`${ team.name } (team id: ${ team.id }) deleted by ${ usr }`);
          res.status(200).send({
            deleted: true,
            msg: `${ team.name } (team id: ${ team.id }) deleted`
          });
        }).catch(e => {
          logger.error(`Error deleting team - ${ e }`);
          res.status(500).send({
            deleted: false,
            msg: `mysql error deleting ${ team.name } - ${ e }`
          });
        });
      }
    }

  }],

  // ajax route to see if new team name is available (not currently taken)
  get_available_name: [utils.isAjax, async (req, res, name) => {

    try {
      const team = await models.Team.findOne({ where: { name: name } });
      res.send(!team);
    } catch (e) {
      logger.error(`error searching for team name (${ e })`);
      res.send(false);
    }

  }],

  // ajax route to find team based on search param
  get_find_name: [utils.isAjax, async (req, res, name) => {

    try {
      const teams = await models.Team.findAll({ where: { name: { [Op.like]: `%${ name }%` } }, attributes: ['id', 'name'] });
      res.send(teams);
    } catch (e) {
      logger.error(`Can't search teams for '${ name }'. (${ e })`);
      res.send(false);
    }

  }],

  // get available teams for killer game
  get_killer_name_kid_uid: async (req, res, name, kid, uid) => {

    let ids = [];
    try {
      if (!kid || !uid) throw new Error('missing params');
      // get all the used team ids into simple array
      const used = await models.Khistory.findAll({
        where: { user_id: uid, killer_id: kid },
        attributes: ['team_id']
      });
      used.map(u => ids.push(u.team_id));

      // now find english league teams which match the search fragment, _and_ are not already used
      const teams = await models.Team.findAll({
        where: { name: { [Op.like]: `%${ name }%` }, englishleague: 1, id: { [Op.notIn]: ids } },
        attributes: ['id', 'name'],
        raw: true
      });

      res.send(teams);
    } catch (e) {

      res.send(null);
    }
  }

};

module.exports = controller;
