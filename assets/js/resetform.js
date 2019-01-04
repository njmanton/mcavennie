/* eslint-env browser, jquery */
/* eslint prefer-template: 0 no-console: 0 */
'use strict';

// called by GET /user/reset/:code
$(function () {

  function check() {
    var pwd = $('#password'),
        rpt = $('#repeat');

    var state = (pwd.val().length > 7) && (rpt.val().length > 7) && pwd.val() == rpt.val();

    if (state) {
      $('#confirm-reset').removeAttr('disabled');
    } else {
      $('#confirm-reset').attr('disabled', 'disabled');
    }
  }

  $('#confirm-reset').attr('disabled', 'disabled');
  check();

  $('#password').on('blur', function() {
    var fld = $(this);
    if (fld.val().length < 8) {
      fld.next().addClass('err').removeClass('success').html('⚠️').attr('title', 'password too short').show();
    } else {
      fld.next().addClass('success').removeClass('err').html('&#10003;').attr('title', 'validated').show();
    }
    check();
  });

  $('#repeat').on('blur', function() {
    var fld = $(this);
    if (fld.val().length < 8 || fld.val() != $('#password').val()) {
      fld.next().addClass('err').removeClass('success').html('⚠️').attr('title', 'password too short or does not match').show();
    } else {
      fld.next().addClass('success').removeClass('err').html('&#10003;').attr('title', 'validated').show();
    }
    check();
  });

});
