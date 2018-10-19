/* eslint-env browser, jquery */
/* eslint no-console: 0 */
'use strict';

$(function() {

  $('#predTable .score').on('change', function() {
    var t = $(this),
        uid = $('#preds').data('uid');
    t.parent().parent().removeClass('ajaxChange');
    var mid = t.data('mid') || t.parent().parent().data('mid');
    $.post({
      url: '/predictions/update',
      data: {
        pid: t.data('pid'),
        mid: mid,
        uid: uid,
        pred: t.val().trim()
      }
    }).done(function(res) {
      t.parent().parent().addClass('ajaxChange');
      console.log(res);
    }).fail(function(res) {
      console.log(res);
    });
  });

  $('#predTable input:radio').on('click', function() {
    var t = $(this);
    var uid = $('#preds').data('uid');
    var wid = $('#preds').data('week');
    var mid = t.data('mid') || t.parent().parent().data('mid');
    $.post({
      url: '/predictions/joker',
      data: {
        uid: uid,
        week: wid,
        mid: mid
      }
    }).done(function(res) {
      console.log(res);
    }).fail(function(res) {
      console.log(res);
    });
  });

});
