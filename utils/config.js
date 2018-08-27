'use strict';

const config = {

  callbacks: {
    'FB': 'http://localhost:1980/auth/facebook/callback',
    'GG': 'http://localhost:1980/auth/google/callback'
  },

  cfg: {
    ignoreExpiry:   0, // ignores deadlines
    allowCurlAjax:  1, // allow a curl request sent to an ajax-only route
    allowCurlAuth:  0, // allow a curl request sent to an authorised route
    allowCurlAdmin: 1, // allow a curl request sent to an admin-only route
    allowCurlAnon:  0  // allow a curl request send to an anon-only route
  },

  logToConsole: true,

  goalmine: {
    start_week: 601,
    league_start: 601,
    start_date: '2018-08-01',
    league_weeks: 30,
    hide_bets: 1,
    pts_closest: 3,
    win_pct: 0.75
  }
};

module.exports = config;
