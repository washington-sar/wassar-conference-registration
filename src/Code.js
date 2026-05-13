/**
 * Code.gs — Main server-side logic for the WSSAR Conference Registration web app.
 *
 * Handles HTTP routing, registration CRUD, and email sending.
 */

function getScriptUrl() {
  return ScriptApp.getService().getUrl();
}

function getEmailForRegistration(registrationId) {
  if (!registrationId) return '';
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Registrations');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === registrationId) return data[i][2] || '';
  }
  return '';
}

// ── HTTP Handlers ──

function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) || 'index';
  var params = e && e.parameter ? e.parameter : {};
  switch (page) {
    case 'status':
      var statusHtml = HtmlService.createHtmlOutputFromFile('Status');
      var statusEmail = params.email || '';
      var statusContent = statusHtml.getContent().replace('/*PARAMS*/', 'var _urlEmail="' + statusEmail.replace(/"/g, '') + '";');
      return HtmlService.createHtmlOutput(statusContent).setTitle('Registration Status')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    case 'confirm':
      var confirmHtml = HtmlService.createHtmlOutputFromFile('Confirm');
      confirmHtml.setTitle('Registration Confirmed');
      var confirmEmail = params.email || '';
      var content = confirmHtml.getContent().replace('/*PARAMS*/', 'var _email="' + confirmEmail.replace(/"/g, '') + '";');
      return HtmlService.createHtmlOutput(content).setTitle('Registration Confirmed')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    default:
      var indexHtml = HtmlService.createHtmlOutputFromFile('Index');
      var indexEmail = params.email || '';
      var indexContent = indexHtml.getContent().replace('/*PARAMS*/', 'var _urlEmail="' + indexEmail.replace(/"/g, '') + '";');
      return HtmlService.createHtmlOutput(indexContent).setTitle('Conference Registration')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

function doPost(e) {
  // Stripe webhook handler
  if (e && e.postData) {
    var result = handleStripeWebhook(e.postData.contents);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Registration CRUD ──

function generateRegistrationId() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Registrations');
  var lastRow = sheet.getLastRow(); // includes header
  var config = getAllConfig();
  var prefix = config['RegistrationPrefix'] || 'WSSAR';
  var count = lastRow.toString().padStart(3, '0');
  return prefix + '-' + count;
}

function submitRegistration(formData) {
  try {
    if (!isRegistrationOpen()) {
      return JSON.stringify({ status: 'error', message: 'Registration is closed.' });
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Registrations');
    var existingRow = findRegistrationRowByEmail(formData.email);

    var registrationId;
    if (existingRow > 0) {
      // Update existing registration
      registrationId = sheet.getRange(existingRow, 1).getValue();
      updateRegistrationRow(sheet, existingRow, registrationId, formData);
    } else {
      // New registration
      registrationId = generateRegistrationId();
      appendRegistrationRow(sheet, registrationId, formData);
    }

    // Save guests
    saveGuests(registrationId, formData.guests || []);

    // Calculate totals
    var total = calculateTotal(formData);
    var stripe = calculateStripeFees(total);
    var stripeUrl = '';

    // Stripe + email are non-critical — don't block registration
    try {
      stripeUrl = createStripeUrl(stripe.stripeAmount, registrationId, formData.email, formData);
    } catch (stripeErr) {
      Logger.log('Stripe URL error: ' + stripeErr.message);
    }
    try {
      sendConfirmationEmail(formData, registrationId, total, stripe, stripeUrl);
    } catch (emailErr) {
      Logger.log('Email error: ' + emailErr.message);
    }

    return JSON.stringify({
      status: 'ok',
      registrationId: registrationId,
      total: total,
      totalWithFees: stripe.totalWithFees,
      fees: stripe.fees,
      stripeUrl: stripeUrl
    });
  } catch (e) {
    return JSON.stringify({ status: 'error', message: e.message });
  }
}

function appendRegistrationRow(sheet, registrationId, data) {
  sheet.appendRow([
    registrationId,
    new Date(),
    data.email,
    data.phone || '',
    data.name,
    data.chapter || '',
    data.officeTitle || '',
    data.affiliations || '',
    data.additionalDetails || '',
    data.lodging || '',
    data.registrationCount || 1,
    data.specialMealRequests || '',
    data.raffleTickets || 0,
    data.donation || '',
    calculateTotal(data),
    'Unpaid',
    0,
    JSON.stringify(data.meals || {})
  ]);
}

function updateRegistrationRow(sheet, row, registrationId, data) {
  var values = [
    registrationId,
    sheet.getRange(row, 2).getValue(), // preserve original timestamp
    data.email,
    data.phone || '',
    data.name,
    data.chapter || '',
    data.officeTitle || '',
    data.affiliations || '',
    data.additionalDetails || '',
    data.lodging || '',
    data.registrationCount || 1,
    data.specialMealRequests || '',
    data.raffleTickets || 0,
    data.donation || '',
    calculateTotal(data),
    sheet.getRange(row, 16).getValue(), // preserve payment status
    sheet.getRange(row, 17).getValue(), // preserve amount paid
    JSON.stringify(data.meals || {})
  ];
  sheet.getRange(row, 1, 1, values.length).setValues([values]);
}

function findRegistrationRowByEmail(email) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Registrations');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][2]).toLowerCase() === email.toLowerCase()) {
      return i + 1; // 1-indexed row
    }
  }
  return -1;
}

// ── Guest Management ──

function saveGuests(registrationId, guests) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Guests');

  // Remove existing guests for this registration
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === registrationId) {
      sheet.deleteRow(i + 1);
    }
  }

  // Add new guests
  for (var j = 0; j < guests.length; j++) {
    var g = guests[j];
    var mealValues = [];
    if (g.meals) {
      for (var event in g.meals) {
        mealValues.push(event + ': ' + g.meals[event]);
      }
    }
    sheet.appendRow([
      registrationId,
      g.name || '',
      g.email || '',
      g.affiliations || '',
      g.specialMealRequests || '',
      mealValues.join('; ')
    ]);
  }
}

// ── Total Calculation ──

function calculateTotal(formData) {
  var pricing = getPricing();
  var total = 0;

  // Registration fee
  var regCount = Number(formData.registrationCount) || 1;
  var regPrice = pricing['Registration'] ? pricing['Registration'].price : 15;
  total += regCount * regPrice;

  // Compatriot meals
  if (formData.meals) {
    for (var event in formData.meals) {
      total += Number(formData.meals[event].price) || 0;
    }
  }

  // Guest meals
  var guests = formData.guests || [];
  for (var i = 0; i < guests.length; i++) {
    if (guests[i].meals) {
      for (var gEvent in guests[i].meals) {
        total += Number(guests[i].meals[gEvent].price) || 0;
      }
    }
  }

  // Raffle tickets
  var raffleCount = Number(formData.raffleTickets) || 0;
  var rafflePrice = pricing['Raffle Tickets'] ? pricing['Raffle Tickets'].price : 25;
  total += raffleCount * rafflePrice;

  // Donation
  if (formData.donation) {
    var donationPricing = pricing[formData.donation];
    if (donationPricing) {
      total += donationPricing.price;
    } else {
      total += Number(formData.donation) || 0;
    }
  }

  return total;
}

// ── Status Lookup ──

function lookupRegistration(email) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Registrations');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][2]).toLowerCase() === email.toLowerCase()) {
      var reg = {};
      for (var j = 0; j < headers.length; j++) {
        reg[headers[j]] = data[i][j];
      }
      // Fetch guests
      reg.guests = getGuestsForRegistration(reg.RegistrationID);
      // Recalculate payment info
      var total = data[i][headers.indexOf('TotalDue')];
      var stripe = calculateStripeFees(total);
      // Build minimal formData for Stripe line items
      var lookupFormData = {
        registrationCount: reg.RegistrationCount || 1,
        raffleTickets: reg.RaffleTickets || 0,
        donation: reg.Donation || ''
      };
      // Calculate meal total as remainder
      var pricing = getPricing();
      var regPrice = pricing['Registration'] ? pricing['Registration'].price : 15;
      var regTotal = (Number(lookupFormData.registrationCount) || 1) * regPrice;
      var rafflePrice = pricing['Raffle Tickets'] ? pricing['Raffle Tickets'].price : 25;
      var raffleTotal = (Number(lookupFormData.raffleTickets) || 0) * rafflePrice;
      var donationTotal = 0;
      if (lookupFormData.donation) {
        var dp = pricing[lookupFormData.donation];
        donationTotal = dp ? dp.price : (Number(lookupFormData.donation) || 0);
      }
      var mealTotal = total - regTotal - raffleTotal - donationTotal;
      if (mealTotal > 0) {
        lookupFormData.meals = { 'Meals': { option: '', price: mealTotal } };
      }
      reg.stripeUrl = '';
      try {
        reg.stripeUrl = createStripeUrl(stripe.stripeAmount, reg.RegistrationID, email, lookupFormData);
      } catch (e) {
        Logger.log('Stripe URL error in lookup: ' + e.message);
      }
      reg.totalWithFees = stripe.totalWithFees;
      reg.fees = stripe.fees;
      reg.isOpen = isRegistrationOpen();
      return JSON.stringify(reg);
    }
  }
  return null;
}

function getGuestsForRegistration(registrationId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Guests');
  var data = sheet.getDataRange().getValues();
  var guests = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === registrationId) {
      guests.push({
        name: data[i][1],
        email: data[i][2],
        affiliations: data[i][3],
        specialMealRequests: data[i][4],
        mealsRaw: data[i][5]
      });
    }
  }
  return guests;
}

// ── Email ──

function sendConfirmationEmail(formData, registrationId, total, stripe, stripeUrl) {
  var config = getAllConfig();
  var eventName = config['EventName'] || 'WSSAR Conference';

  var summary = buildSummaryText(formData, registrationId);

  var plainBody = 'Thank you for registering for the ' + eventName + '!\n\n' +
    'Your Registration ID: ' + registrationId + '\n\n' +
    'Amount Due:\n' +
    'Check/Zelle Total: $' + total.toFixed(2) + '\n' +
    'Credit Card Total: $' + stripe.totalWithFees.toFixed(2) + '\n\n' +
    'Payment Options:\n\n' +
    '1. Use Zelle (no fees, preferred):\n' +
    '   Send to: ' + (config['PaymentEmail'] || 'treasurer@washingtonsar.org') + '\n' +
    '   Include Registration ID ' + registrationId + ' in memo\n\n' +
    '2. Mail a Check:\n' +
    '   Make checks payable to: ' + (config['CheckPayableTo'] || 'Washington SAR') + '\n' +
    '   Include Registration ID ' + registrationId + ' in memo\n' +
    '   Mail to:\n' +
    '   ' + (config['MailTo'] || '') + '\n\n' +
    '3. Pay with Credit Card (~3% fee):\n' +
    '   Total with fee: $' + stripe.totalWithFees.toFixed(2) +
    ' (includes $' + stripe.fees.toFixed(2) + ' fee)\n' +
    '   Pay here: ' + stripeUrl + '\n\n' +
    'Conference Questions? ' + (config['ConferenceContact'] || '') + '\n' +
    'Payment Questions? ' + (config['PaymentContact'] || '') + '\n\n' +
    summary;

  var htmlBody = buildConfirmationHtml(formData, registrationId, total, stripe, stripeUrl, config, summary);

  MailApp.sendEmail({
    to: formData.email,
    cc: config['PaymentEmail'] || '',
    subject: eventName + ' Registration Confirmation',
    body: plainBody,
    htmlBody: htmlBody
  });
}

function buildSummaryText(formData, registrationId) {
  var lines = ['Registration Details:\n'];
  lines.push('Registration ID: ' + registrationId);
  lines.push('Name: ' + formData.name);
  if (formData.phone) lines.push('Phone: ' + formData.phone);
  if (formData.chapter) lines.push('Chapter: ' + formData.chapter);
  if (formData.officeTitle) lines.push('Office/Title: ' + formData.officeTitle);
  if (formData.affiliations) lines.push('Affiliations: ' + formData.affiliations);
  if (formData.additionalDetails) lines.push('Additional Details: ' + formData.additionalDetails);
  if (formData.lodging) lines.push('Lodging: ' + formData.lodging);
  lines.push('Registrants: ' + (formData.registrationCount || 1));

  if (formData.meals) {
    lines.push('\nCompatriot Meals:');
    for (var event in formData.meals) {
      lines.push('  ' + event + ': ' + formData.meals[event].option +
        ' ($' + formData.meals[event].price + ')');
    }
  }

  var guests = formData.guests || [];
  for (var i = 0; i < guests.length; i++) {
    lines.push('\nGuest ' + (i + 1) + ': ' + guests[i].name);
    if (guests[i].meals) {
      for (var gEvent in guests[i].meals) {
        lines.push('  ' + gEvent + ': ' + guests[i].meals[gEvent].option +
          ' ($' + guests[i].meals[gEvent].price + ')');
      }
    }
  }

  if (formData.specialMealRequests) {
    lines.push('\nSpecial Meal Requests: ' + formData.specialMealRequests);
  }
  if (formData.raffleTickets) lines.push('Raffle Tickets: ' + formData.raffleTickets);
  if (formData.donation) lines.push('Donation: ' + formData.donation);

  return lines.join('\n');
}

function buildConfirmationHtml(formData, registrationId, total, stripe, stripeUrl, config, summary) {
  var eventName = config['EventName'] || 'WSSAR Conference';
  return '<!DOCTYPE html><html><head><style>' +
    'body{font-family:Arial,sans-serif;line-height:1.6;color:#333}' +
    '.container{max-width:600px;margin:0 auto;padding:20px}' +
    'h2{color:#1a5490}' +
    '.reg-id{background:#f0f8ff;padding:15px;border-left:4px solid #1a5490;margin:20px 0}' +
    '.totals td{padding:10px 20px;border:1px solid #0b2c82}' +
    '.zelle{background:#b1bde3}.cc{background:#f0abbc;border-color:#9d1736}' +
    '.payment-options{background:#f9f9f9;padding:20px;border-radius:5px;margin:20px 0}' +
    '.payment-options h3{color:#1a5490}' +
    '.btn{display:inline-block;background:#1a5490;color:#fff;padding:12px 30px;' +
    'text-decoration:none;border-radius:5px;font-weight:bold}' +
    '.contact{background:#fff3cd;padding:15px;border-radius:5px;margin:20px 0}' +
    '.details{background:#f9f9f9;padding:20px;border-radius:5px;white-space:pre-line}' +
    '</style></head><body><div class="container">' +
    '<h2>Thank you for registering for the ' + eventName + '!</h2>' +
    '<div class="reg-id"><strong>Your Registration ID:</strong> ' + registrationId + '</div>' +
    '<table class="totals" style="border-collapse:collapse;margin:20px 0">' +
    '<tr><td class="zelle"><strong>Check/Zelle Total:</strong></td>' +
    '<td class="zelle"><strong>$' + total.toFixed(2) + '</strong></td></tr>' +
    '<tr><td class="cc"><strong>Credit Card Total:</strong></td>' +
    '<td class="cc"><strong>$' + stripe.totalWithFees.toFixed(2) + '</strong><br>' +
    '<span style="font-size:12px;color:#666">includes $' + stripe.fees.toFixed(2) + ' fee</span></td></tr>' +
    '</table>' +
    '<div class="payment-options">' +
    '<h2 style="margin-top:0">Payment Options:</h2>' +
    '<div><h3>1. Zelle (no fees, preferred):</h3><ul>' +
    '<li>Send to: <strong>' + (config['PaymentEmail'] || '') + '</strong></li>' +
    '<li>Include Registration ID <strong>' + registrationId + '</strong> in memo</li></ul></div>' +
    '<div><h3>2. Mail a Check:</h3><ul>' +
    '<li>Payable to: <strong>' + (config['CheckPayableTo'] || 'Washington SAR') + '</strong></li>' +
    '<li>Include Registration ID <strong>' + registrationId + '</strong> in memo</li>' +
    '<li>Mail to:<br><strong>' + (config['MailTo'] || '').replace(/\n/g, '<br>') + '</strong></li></ul></div>' +
    '<div><h3>3. Credit Card (~3% fee):</h3>' +
    '<p>Total: <strong>$' + stripe.totalWithFees.toFixed(2) + '</strong> ' +
    '(includes $' + stripe.fees.toFixed(2) + ' fee)</p>' +
    '<a href="' + stripeUrl + '" class="btn" style="color:#fff">Click here to pay</a></div>' +
    '</div>' +
    '<div class="contact"><strong>Questions?</strong><br>' +
    'Conference: ' + (config['ConferenceContact'] || '') + '<br>' +
    'Payment: ' + (config['PaymentContact'] || '') + '</div>' +
    '<div class="details"><h3 style="margin-top:0">Registration Details:</h3>' +
    summary.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>' +
    '</div></body></html>';
}
