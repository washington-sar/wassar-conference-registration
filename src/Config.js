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
  if (!sheet) {
    // Try common variations
    sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('pricing');
    if (!sheet) return {};
  }
  var data = sheet.getDataRange().getValues();
  var pricing = {};
  for (var i = 1; i < data.length; i++) { // skip header
    var key = String(data[i][0]).trim();
    if (key) pricing[key] = { price: Number(data[i][1]) || 0, description: String(data[i][2] || '') };
  }
  return pricing;
}

function isRegistrationOpen() {
  var cutoff = getConfigValue('RegistrationCutoff');
  if (!cutoff) return true;
  return new Date() <= new Date(cutoff);
}

function getFields() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Fields');
  if (!sheet) return {};
  var data = sheet.getDataRange().getValues();
  var fields = {};
  for (var i = 1; i < data.length; i++) {
    fields[data[i][0]] = { label: data[i][1], description: data[i][2] || '' };
  }
  return fields;
}

function getChapters() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Chapters');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var chapters = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) chapters.push(data[i][0]);
  }
  return chapters;
}

function getAffiliations() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Affiliations');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var affils = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) affils.push(data[i][0]);
  }
  return affils;
}
