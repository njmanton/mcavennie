/* eslint-env browser, jquery */
/* eslint no-console: 0 */
'use strict';

$(function() {

  $('#adminMatches input').on('change', function() {
    var box = $(this),
        mid = box.data('mid');

    //console.log('clicked mid', mid);
    $.post('/admin/match/update', {
      mid: mid,
      result: box.val()
    }).done(function(res) {
      console.log(res);
    }).fail(function(err) {
      console.log(err);
    });

  });

});
