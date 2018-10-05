/* eslint-env browser, jquery */
/* eslint prefer-template: 0 */
$(function() {

  $('#proposedTeam').on('keyup', function() {

    var team_dup = $('#team-dup'),
        submit = $('#addTeam');
    var box = $(this);
    if (box.val().length > 2) {
      $.get('/teams/available/' + box.val())
        .done(function(res) {
          if (res) {
            team_dup.addClass('success').removeClass('err').html('√').show();
            submit.removeAttr('disabled');
          } else {
            team_dup.addClass('err').removeClass('success').html('exists').show();
            submit.attr('disabled', 'disabled');
          }
        });
    } else {
      team_dup.hide();
    }

  });

  $('#proposedLeague').on('keyup', function() {

    var league_dup = $('#league-dup'),
        submit = $('#addLeague');
    var box = $(this);
    if (box.val().length > 2) {
      $.get('/leagues/available/' + box.val())
        .done(function(res) {
          if (res) {
            league_dup.addClass('success').removeClass('err').html('√').show();
            submit.removeAttr('disabled');
          } else {
            league_dup.addClass('err').removeClass('success').html('exists').show();
            submit.attr('disabled', 'disabled');
          }
        });
    } else {
      league_dup.hide();
    }

  });

  $('#teamCountry').easyAutocomplete({
    url: '/js/countries.json',
    getValue: 'name',
    list: {
      match: {
        enabled: true
      },
      maxNumberOfElements: 8,
      onSelectItemEvent: function() {
        var id = $('#teamCountry').getSelectedItemData().code;
        $('#countryCode').val(id);
      }
    },
    template: {
      type: 'custom',
      method: function(value, item) {
        return '<span class="flag-icon flag-icon-' + (item.code).toLowerCase() + '"></span> ' + value;
      }
    }
  }).on('blur', function() {
    if ($(this).getSelectedItemData() == -1) {
      $(this).val('');
      $('#countryCode').val('');
    }
  });

  $('#leagueCountry').easyAutocomplete({
    url: '/js/countries.json',
    getValue: 'name',
    list: {
      match: {
        enabled: true
      },
      maxNumberOfElements: 8,
      onSelectItemEvent: function() {
        var id = $('#leagueCountry').getSelectedItemData().code;
        $('#countryCode').val(id);
      }
    },
    template: {
      type: 'custom',
      method: function(value, item) {
        return '<span class="flag-icon flag-icon-' + (item.code).toLowerCase() + '"></span> ' + value;
      }
    }
  }).on('blur', function() {
    if ($(this).getSelectedItemData() == -1) {
      $(this).val('');
      $('#countryCode').val('');
    }
  });

});
