/* eslint no-console: 0 */
'use strict';

const express         = require('express'),
      app             = express(),
      pkg             = require('./package.json'),
      bp              = require('body-parser'),
      expressSession  = require('express-session'),
      excon           = require('express-controller'),
      flash           = require('connect-flash'),
      models          = require('./models'),
      logger          = require('./logs'),
      path            = require('path'),
      moment          = require('moment'),
      bars            = require('express-handlebars');

const router          = express.Router();

// handlebars as templating engine
var hbs = bars.create({
  defaultLayout: 'default',
  extname: '.hbs',
  helpers: {
    // helper to render the remaining lives in Killer
    // lives - # lives before current game, lost - did player lose a life this game
    killerLives: (lives, lost) => {
      if (lives - lost <= 0) {
        return '<span>&#9760;</span>';
      } else {
        let heart = '<span>♥</span>',
            lostheart = '<span class="lost">♥</span>';
        return lost ? heart.repeat(lives - 1) + lostheart : heart.repeat(lives);
      }
    }
  }
});

app.engine('.hbs', hbs.engine);
app.set('view engine', '.hbs');

// set static routes
app.use(express.static('assets'));
app.use('/assets/flags', express.static(path.join(__dirname, 'node_modules/flag-icon-css/')));

// body-parsing for post requests
app.use(bp.urlencoded({ 'extended': true }));
app.use(bp.json());

app.set('port', process.env.PORT || 1986);

// set up middleware
app.use(expressSession({
  secret: 'du2gIw332fwff6hh',
  resave: false,
  saveUninitialized: false
}));
app.use(flash());
app.use((req, res, next) => {
  res.locals.flash_success = req.flash('success');
  res.locals.flash_error = req.flash('error');
  res.locals.flash_info = req.flash('info');
  res.locals.dev = process.env.NODE_ENV || 'dev';
  next();
});
// authentication using passport.js
require('./auth')(app);

// add routing
app.use(router);
require('./routes')(app);
excon.setDirectory(path.join(__dirname, '/controllers')).bind(router);

app.use((req, res) => {
  res.status(400).render('errors/404', {
    title: 'Uh-oh!'
  });
});

app.locals.pkg = pkg;

//set up sequelize and start server listening
models.sequelize.sync().then( () => {
  console.log('Sequelize initialised at', moment().format('HH:mm:ss ddd'));
  const server = app.listen(app.get('port'), () => {
    console.log(pkg.name, 'running on port', server.address().port);
    if (process.env.NODE_DEV == 'prod') logger.info('server started');
    module.exports = server;
  });
});
