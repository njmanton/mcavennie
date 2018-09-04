/* eslint-env browser, jquery */
/* eslint no-console: 0, prefer-template: 0 */
'use strict';

// auto clear message boxes after 4s
window.setTimeout(function() {
  $('.alert .close').click();
}, 4000);

$(function() {

  // show/hide the sidebar
  $('#sidebarToggle').on('click', function() {
    var sb = $('#sidebar');
    sb.toggleClass('active');
    if (sb.hasClass('active')) {
      if (window.innerWidth >= 768) {
        $('.menu-label').text('MENU');
      } else {
        $('.menu-label').text('HIDE');
      }
    } else {
      if (window.innerWidth >= 768) {
        $('.menu-label').text('HIDE');
      } else {
        $('.menu-label').text('MENU');
      }
    }
  });

  var getPreds = function() {
    $.get('/predictions/counts/')
      .done(function(res) {
        try {
          var lst = $('#gm-list');
          for (var x = 0; x < res.length; x++) {
            lst.append(res[x]);
          }
        } catch (e) {
          console.log('error');
        }
      });
    $.get('/bets/counts')
      .done(function(res) {
        try {
          var lst = $('#tp-list');
          for (var x = 0; x < res.length; x++) {
            lst.append(res[x]);
          }
        } catch (e) {
          console.log('error');
        }
      });
    $.get('/killers/games')
      .done(function(res) {
        try {
          var lst = $('#k-list');
          for (var x = 0; x < res.length; x++) {
            lst.append(res[x]);
          }
        } catch (e) {
          console.log('error');
        }
      });
  };
  getPreds();

  $('#sendPreview').on('click', function() {
    $.post({
      url: '/posts/preview',
      data: {
        body: $('#adminMailBody').val()
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
