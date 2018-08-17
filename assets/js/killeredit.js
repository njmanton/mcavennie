/* eslint-env browser, jquery */
/* eslint no-console: 0, prefer-template: 0 */
'use strict';

$(function() {

  var kid = $('form').data('kid'),
      uid = $('form').data('uid');

  $('#addKillerHome').easyAutocomplete({
    url: function(phrase) {
      return '/teams/killer/' + phrase + '/' + kid + '/' + uid;
    },
    getValue: 'name',
    list: {
      onSelectItemEvent: function() {
        var id = $('#addKillerHome').getSelectedItemData().id;
        $('#addKillerHomeId').val(id);
      }
    }
  }).on('blur', function() {
    if ($(this).getSelectedItemData() == -1) {
      $('#addKillerHome').val('');
      $('#addKillerHomeId').val('');
    }
  });

  $('#addKillerAway').easyAutocomplete({
    url: function(phrase) {
      return '/teams/killer/' + phrase + '/' + kid + '/' + uid;
    },
    getValue: 'name',
    list: {
      onSelectItemEvent: function() {
        var id = $('#addKillerAway').getSelectedItemData().id;
        $('#addKillerAwayId').val(id);
      }
    }
  }).on('blur', function() {
    if ($(this).getSelectedItemData() == -1) {
      $('#addKillerAway').val('');
      $('#addKillerAwayId').val('');
    }
  });

});
