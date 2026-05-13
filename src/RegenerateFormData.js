/**
 * RegenerateFormData.gs — Compiles sheet data into a cached JSON string for fast page loads.
 *
 * Run regenerateFormData() from the Apps Script editor after changing any of these sheets:
 *   Config, Meals, Pricing, Fields, Chapters, Affiliations
 *
 * The compiled data is stored in Script Properties (not the spreadsheet) and served
 * instantly to form visitors without re-reading the sheets each time.
 */

function regenerateFormData() {
  var data = JSON.stringify({
    config: getAllConfig(),
    meals: getMealOptions(),
    pricing: getPricing(),
    fields: getFields(),
    chapters: getChapters(),
    affiliations: getAffiliations()
  });
  PropertiesService.getScriptProperties().setProperty('FORM_DATA', data);
  Logger.log('Form data regenerated (' + data.length + ' bytes)');
}

function getFormData() {
  var data = PropertiesService.getScriptProperties().getProperty('FORM_DATA');
  if (!data) {
    regenerateFormData();
    data = PropertiesService.getScriptProperties().getProperty('FORM_DATA');
  }
  var parsed = JSON.parse(data);
  try { parsed.isOpen = isRegistrationOpen(); } catch(e) { parsed.isOpen = true; }
  return JSON.stringify(parsed);
}
