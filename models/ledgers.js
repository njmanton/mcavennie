'use strict';

const Ledger = (sequelize, DataTypes) => {

  const Op      = require('sequelize').Op,
        moment  = require('moment'),
        logger  = require('winston');

  const model = sequelize.define('ledgers', {
    id: {
      type: DataTypes.INTEGER(10),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    description: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    amount: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    }
  });

  model.view = async uid => {
    const models = require('.');

    try {
      const ledgers = await models.Ledger.findAll({
        where: { user_id: uid, updatedAt: { [Op.gte]: '2017-08-01' } },
        attributes: ['id', 'description', 'amount'],
        include: {
          model: models.User,
          attributes: ['id', 'username']
        }
      });
      if (ledgers.length == 0) return null;

      const username = uid == 0 ? 'Pot' : ledgers[0].user.username;
      let running = 0;
      ledgers.map(ledger => {
        ledger.date = moment(ledger.updatedAt).format('ddd DD MMM');
        ledger.balance = (ledger.amount + running);
        running += ledger.amount;
        ledger.negbalance = ledger.balance < 0;
        ledger.negamt = ledger.amount < 0;
        ledger.balance = ledger.balance.toLocaleString('en-GB', { style: 'currency', currency: 'GBP'});
        ledger.amount = ledger.amount.toLocaleString('en-GB', { style: 'currency', currency: 'GBP'});
      });
      return {
        username: username,
        rows: ledgers
      };
    } catch (e) {
      logger.error(`Could not view ledger for user ${ uid } (${ e })`);
      return null;
    }

  };

  // get the total blaance for a given player
  model.balance = async uid => {
    const models = require('.');

    try {

      const rows = await models.Ledger.findAll({
        where: { user_id: uid, updatedAt: { [Op.gte]: '2018-08-01'} },
        attributes: ['amount']
      });
      return rows.map(el => el.amount).reduce((sum, value) => sum + value, 0);

    } catch (e) {
      logger.error(`could not get ledger balance for user ${ uid } (${ e })`);
      return null;
    }



  };

  return model;
};

module.exports = Ledger;
