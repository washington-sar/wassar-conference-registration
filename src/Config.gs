/**
 * Config.gs — Reads configuration from spreadsheet tabs.
 *
 * Expected sheet tabs:
 *   Config: key/value pairs (col A = key, col B = value)
 *   Meals:  columns: Event, Option, Price
 *   Pricing: columns: Item, Price, Description
 */

function getConfigValue(key) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
  var data = sheet.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === key) {
      return data[i][1];
    }
  }
  return '';
}

function getAllConfig() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
  var data = sheet.getDataRange().getValues();
  var config = {};
  for (var i = 1; i < data.length; i++) { // skip header
    config[data[i][0]] = data[i][1];
  }
  return config;
}

function getMealOptions() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Meals');
  var data = sheet.getDataRange().getValues();
  var meals = {};
  for (var i = 1; i < data.length; i++) { // skip header
    var event = data[i][0];  // e.g., "Friday Dinner, April 24"
    var option = data[i][1]; // e.g., "Chicken Dijon"
    var price = data[i][2];  // e.g., 48
    if (!meals[event]) {
      meals[event] = [];
    }
    meals[event].push({ option: option, price: price });
  }
  return meals;
}

function getPricing() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Pricing');
  var data = sheet.getDataRange().getValues();
  var pricing = {};
  for (var i = 1; i < data.length; i++) { // skip header
    pricing[data[i][0]] = { price: data[i][1], description: data[i][2] || '' };
  }
  return pricing;
}

function isRegistrationOpen() {
  var cutoff = getConfigValue('RegistrationCutoff');
  if (!cutoff) return true;
  return new Date() <= new Date(cutoff);
}
