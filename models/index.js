'use strict';

const Sequelize = require('sequelize'),
      operatorsAliases = false, //{ false
        // $lt: Sequelize.Op.lt,
        // $gte: Sequelize.Op.gte,
        // $or: Sequelize.Op.or,
        // $and: Sequelize.Op.and
      //},
      sequelize = new Sequelize(process.env.GM_CONN, { logging: null, operatorsAliases }),
      db = {
        Match:       sequelize.import('./matches.js'),
        Team:        sequelize.import('./teams.js'),
        League:      sequelize.import('./leagues.js'),
        Bet:         sequelize.import('./bets.js'),
        User:        sequelize.import('./users.js'),
        Ledger:      sequelize.import('./ledgers.js'),
        Prediction:  sequelize.import('./predictions.js'),
        Killer:      sequelize.import('./killers.js'),
        Kentry:      sequelize.import('./kentries.js'),
        Week:        sequelize.import('./weeks.js'),
        Standing:    sequelize.import('./standings.js'),
        Post:        sequelize.import('./posts.js'),
        Place:       sequelize.import('./places.js'),
        Khistory:    sequelize.import('./khistories.js')
      };

// define model associations

// team[a] 1:n match
// team[b] 1:n match
db.Team.hasMany(db.Match);
db.Match.belongsTo(db.Team, { as: 'TeamA', foreignKey: 'teama_id' });
db.Match.belongsTo(db.Team, { as: 'TeamB', foreignKey: 'teamb_id' });

// user 1:n post
db.User.hasMany(db.Post, { foreignKey: 'author_id' });
db.Post.belongsTo(db.User, { foreignKey: 'author_id' });

// // league 1:n match
db.League.hasMany(db.Match, { foreignKey: 'league_id' });
db.Match.belongsTo(db.League, { foreignKey: 'league_id' });

// user 1:n prediction
db.User.hasMany(db.Prediction, { foreignKey: 'user_id' });
db.Prediction.belongsTo(db.User, { foreignKey: 'user_id' });

// user 1:n bet
db.User.hasMany(db.Bet, { foreignKey: 'user_id' });
db.Bet.belongsTo(db.User, { foreignKey: 'user_id' });

// match 1:n prediction
db.Match.hasMany(db.Prediction, { foreignKey: 'match_id' });
db.Prediction.belongsTo(db.Match, { foreignKey: 'match_id' });

// match 1:n bet
db.Match.hasMany(db.Bet, { foreignKey: 'match_id' });
db.Bet.belongsTo(db.Match, { foreignKey: 'match_id' });

// week 1:n match
db.Week.hasMany(db.Match, { foreignKey: 'week_id' });
db.Match.belongsTo(db.Week, { foreignKey: 'week_id' });

// user 1:n standings
db.User.hasMany(db.Standing, { foreignKey: 'user_id' });
db.Standing.belongsTo(db.User, { foreignKey: 'user_id' });

// week 1:n standings
db.Week.hasMany(db.Standing, { foreignKey: 'week_id' });
db.Standing.belongsTo(db.Week, { foreignKey: 'week_id' });

// user 1:n places
db.User.hasMany(db.Place, { foreignKey: 'user_id' });
db.Place.belongsTo(db.User, { foreignKey: 'user_id' });

// week 1:n places
db.Week.hasMany(db.Place, { foreignKey: 'week_id' });
db.Place.belongsTo(db.Week, { foreignKey: 'week_id' });

// user 1:n ledgers
db.User.hasMany(db.Ledger, { foreignKey: 'user_id' });
db.Ledger.belongsTo(db.User, { foreignKey: 'user_id' });

// killer 1:n kentry
db.Killer.hasMany(db.Kentry, { foreignKey: 'killer_id' });
db.Kentry.belongsTo(db.Killer, { foreignKey: 'killer_id' });

// killer 1:1 week
db.Killer.hasOne(db.Week, { foreignKey: 'id' });
db.Week.belongsTo(db.Killer, { foreignKey: 'id' });

// match 1:n kentry
db.Match.hasMany(db.Kentry, { foreignKey: 'match_id' });
db.Kentry.belongsTo(db.Match, { foreignKey: 'match_id' });

// user 1:n kentry
db.User.hasMany(db.Kentry, { foreignKey: 'user_id' });
db.Kentry.belongsTo(db.User, { foreignKey: 'user_id' });

// week 1:n kentry
db.Week.hasMany(db.Kentry, { foreignKey: 'week_id' });
db.Kentry.belongsTo(db.Week, { foreignKey: 'week_id' });

// user 1:n killer
db.User.hasMany(db.Killer, { foreignKey: 'admin_id' });
db.Killer.belongsTo(db.User, { foreignKey: 'admin_id' });

// user 1:n khistory
db.User.hasMany(db.Khistory, { foreignKey: 'user_id' });
db.Khistory.belongsTo(db.User, { foreignKey: 'user_id' });

// killer 1:n khistory
db.Killer.hasMany(db.Khistory, { foreignKey: 'killer_id' });
db.Khistory.belongsTo(db.Killer, { foreignKey: 'killer_id' });

// team 1:n khistory
db.Team.hasMany(db.Khistory, { foreignKey: 'team_id' });
db.Khistory.belongsTo(db.Team, { foreignKey: 'team_id' });

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
