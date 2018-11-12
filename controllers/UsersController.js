'use strict';

const models    = require('../models'),
      mail      = require('../mail'),
      bCrypt    = require('bcrypt-nodejs'),
      utils     = require('../utils'),
      logger    = require('winston'),
      Op        = require('sequelize').Op,
      config    = require('../utils/config'),
      moment    = require('moment');

const folder    = 'users';

const controller = {

  get_id: async (req, res, id) => {
    if (req.user && req.user.id == id) {
      res.status(303).redirect('/home');
    } else {
      try {
        let promises = [];
        promises.push(models.User.findById(id));
        promises.push(models.Standing.findAll({
          where: { user_id: id, position: 1, week_id: { [Op.gte]: config.goalmine.start_week } }
        }));
        promises.push(models.Place.findAll({
          where: { user_id: id, rank: 1, week_id: { [Op.gte]: config.goalmine.start_week } }
        }));
        const [user, gmwins, tpwins] = await Promise.all(promises);
        if (!user) throw new Error('no user');
        res.render(`${ folder }/view`, {
          title: user.username,
          player: user,
          gmwins: gmwins,
          tpwins: tpwins,
          admin: user.admin
        });
      } catch (e) {
        logger.error(e);
        res.status(404).render('errors/404');
      }
    }
  },

  get_update: [utils.isAuthenticated, (req, res) => {
    res.render(`${ folder }/update`, {
      title: 'Update details'
    });
  }],

  get_forgot: [utils.isAnon, (req, res) => {
    // requires anon user
    res.render(`${ folder }/forgot`, {
      title: 'Forgotten Password'
    });
  }],

  // handle forgotten password request
  post_forgot: async (req, res) => {
    // validate form fields
    // if username and email exist, reset password
    // post format { username: <username>, email: <email> }
    try {
      const user = await models.User.findOne({
        where: [{ username: req.body.username }, { email: req.body.email }]
      });
      if (!user) throw new Error('no such user');

      logger.info(`${ user.username } made a password reset request`);
      var reset = utils.getTempName(10),
          now = moment().format('ddd DD MMM, HH:mm');
      user.resetpwd = reset;
      try {
        user.save();
        var template = 'reset_request.hbs',
            cc = 'reset_password@goalmine.eu',
            subject = 'Password reset request',
            context = {
              name: req.body.username,
              reset: reset,
              date: now
            };

        mail.send(req.body.email, cc, subject, template, context, mail_result => {
          logger.info(mail_result);
        });
      } catch (e) {
        logger.error(e.name);
      }
      req.flash('info', 'Thank you. If those details were found, you will shortly receive an email explaining how to reset your password');
    } catch (e) {
      req.flash('error', `could not process reset password request (${ e.message })`);
    } finally {
      res.redirect('/');
    }

  },

  // show reset password screen
  get_reset_id: async (req, res, id) => {

    const user = await models.User.findOne({
      where: { resetpwd: id },
      attributes: ['username', 'email']
    });

    if (!user) {
      req.flash('error', 'Sorry, that code wasn\'t recognised. Please try again');
      res.redirect('/');
    } else {
      res.render(`${ folder }/reset`, {
        title: 'Reset Password',
        username: user.username
      });
    }

  },

  // handle reset password request
  post_reset_id: async (req, res, id) => {
    const user = await models.User.findOne({
      where: { resetpwd: id, email: req.body.email }
    });
    // check there's a user with that reset code and email, and don't rely on
    // javascript to enforce password complexity
    if (user && (req.body.pwd.length > 7) && (req.body.pwd == req.body.rpt)) {
      const row = await user.update({
        password: bCrypt.hashSync(req.body.rpt, bCrypt.genSaltSync(10), null),
        resetpwd: null
      });
      if (row) {
        logger.info(`${ user.username } successfully reset their password`);
        req.flash('success', 'Your password has been updated. You can now log in');
      } else {
        req.flash('error', 'Sorry, unable to update that account');
      }
      res.redirect('/');
    } else {
      req.flash('error', 'Sorry, those details were not valid');
      res.redirect('/');
    }

  },

  get_id_tipchart: async (req, res, id) => {
    const bets = await models.Bet.userBets(id);
    res.send(`<pre>${ JSON.stringify(bets, null, 2) }</pre>`);

  },

  get_id_gmchart: async (req, res, id) => {
    const preds = await models.Prediction.userPreds(id);
    res.send(preds);
  },

  get_add: [utils.isAdmin, (req, res) => {
    res.render(`${ folder }/add`, {
      title: 'Add User'
    });
  }],

  post_add: [utils.isAdmin, async (req, res) => {

    let admin = req.user ? req.user.username : '(unknown)';
    const user = await models.User.findOne({
      where: { username: req.body.username }
    });
    if (user) {
      req.flash('error', 'Sorry, that username already exists');
      res.redirect('/users/add');
    } else {
      const newUser = await models.User.create({
        username: req.body.username,
        email: req.body.email,
        password: bCrypt.hashSync(req.body.repeat, bCrypt.genSaltSync(10), null),
        games: 7
      });
      if (newUser) {
        req.flash('success', `${ req.body.username } has been added as a new user`);
        logger.info(`User ${ req.body.username } (${ newUser.id }) was created by ${ admin }`);
      } else {
        req.flash('error', 'Sorry, there was an error creating this user');
      }
      res.redirect('/');

    }
  }],

  get_available_name: async (req, res, name) => {

    try {
      const user = await models.User.findOne({
        where: { username: name }
      });
      res.send(!user);
    } catch (e) {
      logger.error(e);
      res.send(false);
    }

  }

};

module.exports = controller;
