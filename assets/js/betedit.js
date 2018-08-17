/* eslint-env browser, jquery */
/* eslint no-console: 0 */
'use strict';

$(function() {

  $('label').on('click', function() {
    betEditCheck($(this));
  });

  $('input:checkbox').on('change', function() {
    betEditCheck();
  });

  $('input:text').on('change', function() {
    if ($(this).val() < 20 || $(this).val() > 60 || $(this).val() % 5 != 0)  {
      $(this).next().text('!');
    } else {
      $(this).next().text('');
    }
    betEditCheck();
  });

  $('label').on('click', function(e) {
    var row = $(this).parent().parent().parent();
    if (row.hasClass('disableRow')) {
      e.stopPropagation();
    }
  });

  $('input:checkbox').on('click', function() {
    //var row = $(this).parent().parent();
    if ($('input:checkbox:checked').length > 5) {
      $(this).attr('checked', false);
    }
  });

  var betEditCheck = function(ele) {
    var check  = false,
        boxes  = $('input:checkbox:checked').length,
        total  = 0,
        ret    = 0,
        submit = $('#betEditSubmit');

    $('#betEdit tbody tr').each(function() {
      var box = $(this).find('input:checkbox'),
          amt = $(this).find('input:text'),
          sts = $(this).find('input[name*="status"]');
      if (box.is(':checked')) {
        sts.val('active');
        $(this).removeClass('disableRow').find('.btn-odds').removeClass('disabled');
        amt.removeAttr('disabled');
        var sel = $(this).find('label.active');
        total += +amt.val();
        if (ele && ele.data('odds') != undefined && ele.parent().parent().parent().index() == $(this).index()) {
          ret += +amt.val() * (+ele.data('odds') - 1);
        } else {
          if (sel.length) ret += +amt.val() * (+sel.data('odds') - 1);
        }
      } else {
        sts.val('delete');
        $(this).addClass('disableRow').find('.btn-odds').addClass('disabled');
        $(this).find('.btn-group').attr('disabled');
        amt.attr('disabled', 'disabled');
      }
    });

    check = (boxes > 2 && boxes < 6);
    check = check && (total == 100);

    $('#matchcnt').text(boxes);
    $('#totalamt').text(total.toFixed(2));
    $('#totalret').text(ret.toFixed(2));

    if (total != 100) {
      $('#totalamt').parent().addClass('err');
    } else {
      $('#totalamt').parent().removeClass('err');
    }

    if (boxes < 3 && boxes > 5) {
      $('#matchcnt').parent().addClass('err');
    } else {
      $('#matchcnt').parent().removeClass('err');
    }

    if (check) {
      submit.removeAttr('disabled');
    } else {
      submit.attr('disabled', 'disabled');
    }

  };

  betEditCheck();

});
