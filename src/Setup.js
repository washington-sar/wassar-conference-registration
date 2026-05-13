/**
 * Setup.gs — Run setupSheets() once to create all tabs with headers and sample data.
 * Run regenerateFormData() after any changes to Config, Meals, Pricing, Fields, Chapters, or Affiliations.
 */

function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Config tab
  var config = getOrCreateSheet(ss, 'Config');
  config.clear();
  config.getRange(1, 1, 1, 2).setValues([['Key', 'Value']]).setFontWeight('bold');
  config.getRange(2, 1, 16, 2).setValues([
    ['EventName', '2027 Washington SAR Conference'],
    ['EventDates', 'April 23-25, 2027'],
    ['RegistrationPrefix', 'WSSAR27'],
    ['RegistrationCutoff', '2027-04-13'],
    ['StripeTestMode', 'TRUE'],
    ['PaymentEmail', 'treasurer@washingtonsar.org'],
    ['CheckPayableTo', 'Washington SAR'],
    ['MailTo', 'Dan Widdis\n10715 SE 293rd St.\nAuburn WA, 98092'],
    ['ConferenceContact', 'ronnm@outlook.com or 425-533-1229'],
    ['PaymentContact', 'treasurer@washingtonsar.org or 831-392-5967'],
    ['DonationNote', 'Washington SAR is a 501(c)(3) nonprofit. Donations are tax-deductible. EIN: 91-1167420'],
    ['LodgingNote', 'Book your room at the Seattle Airport Marriott using our group rate: [link]'],
    ['ZelleQR', 'https://drive.google.com/uc?export=view&id=10bcXx74D6x3G1wLg4hiza2IXQrnjpoDe'],
    ['RegistrationPrefix', 'WSSAR27'],
    ['EventName', '2027 Washington SAR Conference'],
    ['EventDates', 'April 23-25, 2027']
  ]);
  config.autoResizeColumns(1, 2);

  // Meals tab (order here = display order on form)
  var meals = getOrCreateSheet(ss, 'Meals');
  meals.clear();
  meals.getRange(1, 1, 1, 3).setValues([['Event', 'Option', 'Price']]).setFontWeight('bold');
  meals.getRange(2, 1, 9, 3).setValues([
    ['Friday Dinner, April 24', 'Chicken Dijon', 48],
    ['Friday Dinner, April 24', 'Wild Mushroom Polenta (V)', 48],
    ['Friday Dinner, April 24', 'Grilled Salmon', 52],
    ['Saturday Lunch, April 25', 'Deli Buffet', 40],
    ['Saturday Lunch, April 25', 'Caesar Salad (V)', 35],
    ['Saturday Banquet, April 25', 'Peppered Pork Loin', 48],
    ['Saturday Banquet, April 25', 'Spinach Ravioli (V)', 48],
    ['Saturday Banquet, April 25', 'Grilled Salmon', 52],
    ['Saturday Banquet, April 25', 'Chicken Dijon', 48]
  ]);
  meals.autoResizeColumns(1, 3);

  // Pricing tab (items containing "Donation" appear as donation options)
  var pricing = getOrCreateSheet(ss, 'Pricing');
  pricing.clear();
  pricing.getRange(1, 1, 1, 3).setValues([['Item', 'Price', 'Description']]).setFontWeight('bold');
  pricing.getRange(2, 1, 5, 3).setValues([
    ['Registration', 15, 'Conference registration fee'],
    ['Raffle Tickets', 25, 'Celebrating America 250 Raffle'],
    ['Donation - Patron', 50, 'Patron Donation ($50)'],
    ['Donation - Patriot', 100, 'Patriot Donation ($100)'],
    ['Donation - Minuteman', 200, 'Minuteman Donation ($200)']
  ]);
  pricing.autoResizeColumns(1, 3);

  // Fields tab
  var fields = getOrCreateSheet(ss, 'Fields');
  fields.clear();
  fields.getRange(1, 1, 1, 3).setValues([['FieldID', 'Label', 'Description']]).setFontWeight('bold');
  fields.getRange(2, 1, 8, 3).setValues([
    ['email', 'Email Address', 'Your confirmation and payment link will be sent here'],
    ['phone', 'Phone Number', 'For follow-up if needed'],
    ['name', 'Compatriot Name', ''],
    ['chapter', 'Chapter', 'Select your SAR chapter'],
    ['officeTitle', 'Office/Title', 'Current office or title in chapter, state, or national society'],
    ['affiliations', 'Compatriot Affiliations', 'Select all that apply'],
    ['additionalDetails', 'Additional Details', 'Color guard, special needs, accessibility, etc.'],
    ['lodging', 'Where are you staying?', '']
  ]);
  fields.autoResizeColumns(1, 3);

  // Chapters tab
  var chapters = getOrCreateSheet(ss, 'Chapters');
  chapters.clear();
  chapters.getRange(1, 1, 1, 1).setValues([['Chapter']]).setFontWeight('bold');
  chapters.getRange(2, 1, 11, 1).setValues([
    ['Cascade Centennial'],
    ['Fort Vancouver'],
    ['George Rogers Clark'],
    ['Grand Coulee'],
    ['John Paul Jones'],
    ['Olympia'],
    ['Puget Sound'],
    ['Rainier'],
    ['Ranger'],
    ['Seattle'],
    ['Other (not a Washington SAR member)']
  ]);
  chapters.autoResizeColumns(1, 1);

  // Affiliations tab
  var affils = getOrCreateSheet(ss, 'Affiliations');
  affils.clear();
  affils.getRange(1, 1, 1, 1).setValues([['Affiliation']]).setFontWeight('bold');
  affils.getRange(2, 1, 6, 1).setValues([
    ['WASSAR Color Guard'],
    ['WASSAR Board of Managers'],
    ['NSSAR'],
    ['DAR'],
    ['C.A.R.'],
    ['Other']
  ]);
  affils.autoResizeColumns(1, 1);

  // Registrations tab
  var regs = getOrCreateSheet(ss, 'Registrations');
  regs.clear();
  regs.getRange(1, 1, 1, 18).setValues([[
    'RegistrationID', 'Timestamp', 'Email', 'Phone', 'Name', 'Chapter',
    'OfficeTitle', 'Affiliations', 'AdditionalDetails', 'Lodging',
    'RegistrationCount', 'SpecialMealRequests', 'RaffleTickets', 'Donation',
    'TotalDue', 'PaymentStatus', 'AmountPaid', 'MealSelections'
  ]]).setFontWeight('bold');
  regs.setFrozenRows(1);

  // Guests tab
  var guests = getOrCreateSheet(ss, 'Guests');
  guests.clear();
  guests.getRange(1, 1, 1, 6).setValues([[
    'RegistrationID', 'GuestName', 'GuestEmail', 'GuestAffiliations',
    'SpecialMealRequests', 'Meals'
  ]]).setFontWeight('bold');
  guests.setFrozenRows(1);

  // Payments tab
  var payments = getOrCreateSheet(ss, 'Payments');
  payments.clear();
  payments.getRange(1, 1, 1, 6).setValues([[
    'Date', 'RegistrationID', 'Method', 'Amount', 'PayerEmail', 'TransactionID'
  ]]).setFontWeight('bold');
  payments.setFrozenRows(1);

  // Compile form data as final step
  regenerateFormData();
  Logger.log('Setup complete! Sheets created and form data compiled.');
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}
