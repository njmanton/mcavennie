/* eslint-env browser, jquery */
/* eslint prefer-template: 0 */
$(function() {

  $('button.del').on('click', function() {
    var mid = $(this).data('mid');
    var row = $(this).parent().parent();
    $.ajax({
      url: '/matches/' + mid,
      method: 'delete'
    }).done(function() {
      row.fadeOut(1000);
    }).fail(function(e) {
      alert('Sorry, there was a problem deleting that match: ' + e.messsage);
    });

  });

  // function to validate adding or editing a match
  var addMatchCheck = function() {

    var check = false;

    // check both teams and leagues populated
    check = ($('#addMatchHomeId').val() != '' && $('#addMatchAwayId').val() != '' && $('#addMatchLeagueId').val() != '');
    // check at least one of goalmine or tipping games is selected
    check = check && ($('#gm-check').is(':checked') || $('#tp-check').is(':checked'));

    if ($('#tp-check').is(':checked') && ($('#addMatchOdds1').val() == '' || $('#addMatchOdds2').val() == '' || $('#addMatchOddsX').val() == '')) {
      check = false;
    }
    if (check) {
      $('#addMatchSubmit').removeAttr('disabled');
    } else {
      $('#addMatchSubmit').attr('disabled', 'disabled');
    }
  };

  // catch any bubbled focusout (blur) events from form, and check for compliance
  $('#addMatch').on('focusout', function() {
    addMatchCheck();
  });

  // autocomplete for add match teams
  $('#addMatchHome').easyAutocomplete({
    url: function(phrase) {
      return '/teams/find/' + phrase;
    },
    getValue: 'name',
    list: {
      onSelectItemEvent: function() {
        var id = $('#addMatchHome').getSelectedItemData().id;
        $('#addMatchHomeId').val(id);
      }
    }
  }).on('blur', function() {
    if ($(this).getSelectedItemData() == -1) {
      $(this).val('');
      $('#addMatchHomeId').val('');
    }
  });

  $('#addMatchAway').easyAutocomplete({
    url: function(phrase) {
      return '/teams/find/' + phrase;
    },
    getValue: 'name',
    list: {
      onSelectItemEvent: function() {
        var id = $('#addMatchAway').getSelectedItemData().id;
        $('#addMatchAwayId').val(id);
      }
    }
  }).on('blur', function() {
    if ($(this).getSelectedItemData() == -1) {
      $('#addMatchAway').val('');
      $('#addMatchAwayId').val('');
    }
  });

  // autocomplete for add match league
  $('#addMatchLeague').easyAutocomplete({
    url: function(phrase) {
      return '/leagues/find/' + phrase;
    },
    getValue: 'name',
    list: {
      onSelectItemEvent: function() {
        var id = $('#addMatchLeague').getSelectedItemData().id;
        $('#addMatchLeagueId').val(id);
      }
    },
    template: {
      type: 'custom',
      method: function(value, item) {
        return '<span class="flag-icon flag-icon-' + (item.country).toLowerCase() + '"></span>' + value;
      }
    }
  }).on('blur', function() {
    if ($(this).getSelectedItemData() == -1) {
      $(this).val('');
      $('#addMatchLeagueId').val('');
    }
  });

  // if gotw toggle is clicked, ensure goalmine toggle is too
  $('#addMatchGotw').on('click', function() {
    if ($(this).is(':checked')) {
      $('#gm-check').prop('checked', true);
    }
  });

  // if tipping is toggle, set state of odds buttons
  $('#tp-check').on('click', function() {
    if ($(this).is(':checked')) {
      $('[name^="odds"]').removeAttr('disabled');
      $('#addMatchLeagueId').val(1);
      $('#addMatchLeague').val('Premier League');
    } else {
      $('[name^="odds"]').attr('disabled', 'disabled');
    }
  });

});
