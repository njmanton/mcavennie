'use strict';

const fs      = require('fs'),
      hbs     = require('handlebars'),
      pkg     = require('../package.json'),
      logger  = require('winston'),
      path    = require('path'),
      mailgun = require('mailgun-js')({ apiKey: process.env.MAILGUN_KEY, domain: 'goalmine.eu' });

const mail = {

  send: (recipient, cc, subject, template_file, context, done) => {

    // convert template and context into message
    const template = fs.readFileSync(path.join(__dirname, 'templates', template_file), 'utf8'),
          message = hbs.compile(template);

    // add app details to the context
    context.app = {
      version: pkg.version,
      name: pkg.name
    };

    const data = {
      from: '<no-reply@goalmine.eu>',
      to: recipient,
      subject: subject,
      text: message(context),
      html: message(context)
    };

    if (cc) data.cc = cc;

    mailgun.messages().send(data).then(response => {
      logger.info(`email sent to ${ recipient } with subject ${ subject }`);
      done(response);
    }, err => {
      logger.error(`${ template_file } not sent for user ${ recipient } (${ err })`);
      done(err);
    });
  },
};

module.exports = mail;
