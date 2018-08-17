/* eslint-env browser, jquery */
/* eslint no-console: 0, prefer-template: 0 */
'use strict';

// auto clear message boxes after 4s
window.setTimeout(function() {
  $('.alert .close').click();
}, 4000);

$(function() {

  $('#sendPreview').on('click', function() {
    $.post({
      url: '/posts/preview',
      data: {
        body: $('#sendBody').val()
      }
    }).done(function(res) {
      $('#sendPreviewPane').html(res);
    });
  });

  $('#postPreview').on('click', function() {
    $.post({
      url: '/posts/preview',
      data: {
        body: $('#postAddBody').val()
      }
    }).done(function(res) {
      $('#postPreviewPane').html(res);
    });
  });

  $('[data-delete-post]').on('click', function() {
    var button = $(this);
    var pid = button.data('pid');
    if (window.confirm('Please confirm you wish to delete this post')) {
      $.ajax({
        url: '/posts/' + pid,
        method: 'DELETE'
      }).done(function(res) {
        if (res.delete) {
          if (button.attr('type') == 'button') {
            window.location.href = '/posts/';
          } else {
            button.parent().parent().parent().fadeOut(1500);
          }
        }
      });
    }
  });

});
