'use strict';

const models              = require('../models'),
      bCrypt              = require('bcrypt-nodejs'),
      passport            = require('passport'),
      logger              = require('winston'),
      moment              = require('moment'),
      LocalStrategy       = require('passport-local').Strategy;

module.exports.createHash = password => {
  return bCrypt.hashSync(password, bCrypt.genSaltSync(10), null);
};

module.exports = app => {

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use('local', new LocalStrategy({ passReqToCallback: true },
    (req, username, password, done) => {
      models.User.findOne({
        where: { username: username }
      }).then(user => {
        if (!user) {
          logger.error(`Unknown user '${ username }' attempted login`);
          return done(null, false, { message: 'user not found' });
        }
        try {
          if (!bCrypt.compareSync(password, user.password)) {
            logger.info(`Incorrect password for ${ user.username }`);
            return done(null, false, { message: 'incorrect password' });
          }
        } catch(e) {
          return done(null, false, { message: 'problem entering password' });
        }
        let now = moment().format('YYYY-MM-DD HH:mm:ss');
        user.update({ resetpwd: null, lastlogin: now }); // nullify reset code, if present
        req.flash('success', `logged in. welcome back ${ user.username }`);
        logger.info(`(local) ${ user.username } logged in`);
        return done(null, user);
      }).catch(err => {
        logger.info('Error finding user');
        return done(err);
      });
    }
  ));

  // make user object available in handlebars views
  app.use( async (req, res, next) => {
    if (!res.locals.user && req.user) {
      res.locals.user = req.user;
      res.locals.user.goalmine = (req.user.games & 1) != 0;
      res.locals.user.tipping = (req.user.games & 2) != 0;
      res.locals.user.killer = (req.user.games & 4) != 0;

      res.locals.user.balance = {
        ledger: await models.Ledger.balance(req.user.id),
        goalmine: await models.Standing.balance(req.user.id),
        tipping: await models.Place.balance(req.user.id)
      };

    }
    next();
  });

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser( async (id, done) => {

    const user = await models.User.findById(id);
    done(null, user);

  });

};
