/**
 * Setup.gs — Run setupSheets() once to create all tabs with headers and sample config.
 *
 * After running, update the Config, Meals, and Pricing tabs with your actual event data.
 */

function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Config tab
  var config = getOrCreateSheet(ss, 'Config');
  config.clear();
  config.getRange(1, 1, 1, 2).setValues([['Key', 'Value']]).setFontWeight('bold');
  config.getRange(2, 1, 12, 2).setValues([
    ['EventName', '2027 Washington SAR Conference'],
    ['EventDates', 'April 23-25, 2027'],
    ['RegistrationPrefix', 'WSSAR27'],
    ['RegistrationCutoff', '2027-04-13'],
    ['StripePaymentLink', 'https://buy.stripe.com/YOUR_LINK_HERE'],
    ['PaymentEmail', 'treasurer@washingtonsar.org'],
    ['CheckPayableTo', 'Washington SAR'],
    ['MailTo', 'Dan Widdis\n10715 SE 293rd St.\nAuburn WA, 98092'],
    ['ConferenceContact', 'ronnm@outlook.com or 425-533-1229'],
    ['PaymentContact', 'treasurer@washingtonsar.org or 831-392-5967'],
    ['StripeWebhookSecret', ''],
    ['StatusPageUrl', '']
  ]);
  config.autoResizeColumns(1, 2);

  // Meals tab
  var meals = getOrCreateSheet(ss, 'Meals');
  meals.clear();
  meals.getRange(1, 1, 1, 3).setValues([['Event', 'Option', 'Price']]).setFontWeight('bold');
  meals.getRange(2, 1, 9, 3).setValues([
    ['Friday Dinner, April 24', 'Chicken Dijon', 48],
    ['Friday Dinner, April 24', 'Wild Mushroom Polenta (V)', 48],
    ['Saturday Lunch, April 25', 'Deli Buffet', 40],
    ['Saturday Banquet, April 25', 'Peppered Pork Loin', 48],
    ['Saturday Banquet, April 25', 'Spinach Ravioli (V)', 48],
    ['Saturday Banquet, April 25', 'Grilled Salmon', 52],
    ['Friday Dinner, April 24', 'Grilled Salmon', 52],
    ['Saturday Lunch, April 25', 'Caesar Salad (V)', 35],
    ['Saturday Banquet, April 25', 'Chicken Dijon', 48]
  ]);
  meals.autoResizeColumns(1, 3);

  // Pricing tab
  var pricing = getOrCreateSheet(ss, 'Pricing');
  pricing.clear();
  pricing.getRange(1, 1, 1, 3).setValues([['Item', 'Price', 'Description']]).setFontWeight('bold');
  pricing.getRange(2, 1, 4, 3).setValues([
    ['Registration', 15, 'Conference registration fee'],
    ['Raffle Tickets', 25, 'Celebrating America 250 Raffle'],
    ['Donation - Patriot', 100, 'Patriot Donation ($100)'],
    ['Donation - Minuteman', 50, 'Minuteman Donation ($50)']
  ]);
  pricing.autoResizeColumns(1, 3);

  // Registrations tab
  var regs = getOrCreateSheet(ss, 'Registrations');
  regs.clear();
  regs.getRange(1, 1, 1, 17).setValues([[
    'RegistrationID', 'Timestamp', 'Email', 'Phone', 'Name', 'Chapter',
    'OfficeTitle', 'Affiliations', 'AdditionalDetails', 'Lodging',
    'RegistrationCount', 'SpecialMealRequests', 'RaffleTickets', 'Donation',
    'TotalDue', 'PaymentStatus', 'AmountPaid'
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

  SpreadsheetApp.getUi().alert('Setup complete! Update Config, Meals, and Pricing tabs with your event data.');
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}
