'use strict';

const models    = require('./models'),
      passport  = require('passport'),
      moment    = require('moment'),
      path      = require('path'),
      marked    = require('marked'),
      fs        = require('fs'),
      Op        = require('sequelize').Op,
      logger    = require('winston'),
      emoji     = require('node-emoji'),
      utils     = require('./utils');

const routes = app => {

  app.get('/test',  async (req, res) => {
    const history = await models.Standing.overall(1, 601, false);
    res.send(history);
  });

  app.get('/', async (req, res) => {

    try {
      const threeMonthsAgo = moment().subtract(3, 'months').format('YYYY-MM-DD');
      const posts = await models.Post.findAll({
        where: { createdAt: { [Op.gte]: threeMonthsAgo }, },
        attributes: ['id', 'title', 'body', 'author_id', 'createdAt', 'updatedAt'],
        include: {
          model: models.User,
          attributes: ['id', 'username']
        },
        order: [['sticky', 'desc'], ['updatedAt', 'desc']]
      });

      posts.map(post => {
        post.body = emoji.emojify(marked(post.body));
        post.date = moment(post.createdAt).format('DD MMM, HH:mm');
        post.udate = post.updatedAt ? moment(post.updatedAt).format('DD MMM, HH:mm') : null;
      });

      res.render('main', {
        title: 'Welcome',
        posts: posts
      });

    } catch (e) {
      logger.error(e);
    }

  });

  app.get('/money/:uid', utils.isAuthenticated, (req, res) => {
    if (req.user && (req.params.uid == 0 || req.user.admin || req.user.id == req.params.uid)) {
      models.Ledger.view(req.params.uid).then(data => {
        if (!data) {
          res.status(404).render('errors/404');
        } else {
          res.render('ledgers/view', {
            title: `Ledger for ${ data.username }`,
            data: data.rows
          });
        }

      });
    } else {
      res.sendStatus(403);
    }
  });

  app.get('/pot', utils.isAjax, (req, res) => {
    models.Ledger.balance(0).then(pot => {
      res.status(200).send(pot.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' }));
    });
  });

  // login
  app.get('/login', utils.isAnon, (req, res) => {
    res.render('users/login', {
      title: 'Login'
    });
  });

  app.post('/login',
    passport.authenticate('local', {
      successReturnToOrRedirect: '/home',
      failureRedirect: '/',
      failureFlash: true
    })
  );

  app.get('/home', utils.isAuthenticated, (req, res) => {
    try {
      res.render('users/view', {
        title: 'Home'
      });
    } catch (e) {
      logger.error(e);
    }
  });

  app.get('/logout', (req, res) => {
    let usr = req.user ? req.user.username : '(unknown)';
    logger.info(`${ usr } logged out`);
    req.logout();
    req.flash('info', 'Logged Off');
    res.redirect('/');
  });

  // any other static content
  app.get('/pages/:page', function(req, res) {
    let file = `views/pages/${ req.params.page }.hbs`;
    try {
      fs.accessSync(file, fs.F_OK);
      res.render(path.join('pages', req.params.page), {
        title: req.params.page
      });
    } catch (e) {
      res.status(404).render('errors/404', { title: 'Uh-oh' });
    }
  });
};

module.exports = routes;
