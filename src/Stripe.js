/**
 * Stripe.gs — Stripe fee calculation and webhook handling.
 */

function calculateStripeFees(total) {
  var totalWithFees = (total + 0.30) / 0.971;
  var stripeAmount = Math.round(totalWithFees * 100);
  totalWithFees = stripeAmount / 100;
  return {
    totalWithFees: totalWithFees,
    fees: totalWithFees - total,
    stripeAmount: stripeAmount
  };
}

function createStripeUrl(stripeAmount, registrationId, email, formData) {
  try {
    var testMode = String(getConfigValue('StripeTestMode')).trim().toUpperCase();
    var propKey = (testMode === 'TRUE') ? 'STRIPE_TEST_KEY' : 'STRIPE_SECRET_KEY';
    var secretKey = PropertiesService.getScriptProperties().getProperty(propKey);
    if (!secretKey) return '';

  var config = getAllConfig();
  var successUrl = getScriptUrl() + '?page=confirm&reg_id=' + registrationId + '&email=' + encodeURIComponent(email);
  var cancelUrl = getScriptUrl() + '?page=status';

  var payload = {
    'payment_method_types[]': 'card',
    'mode': 'payment',
    'client_reference_id': registrationId,
    'customer_email': email,
    'success_url': successUrl,
    'cancel_url': cancelUrl
  };

  // Build itemized line items
  var items = buildLineItems(formData);

  // Find donation amount for receipt metadata
  var donationAmount = 0;
  for (var d = 0; d < items.length; d++) {
    if (items[d].name.indexOf('Donation') === 0) donationAmount = items[d].amount / 100;
  }
  if (donationAmount > 0) {
    payload['payment_intent_data[metadata][tax_deductible_amount]'] = '$' + donationAmount.toFixed(2);
    payload['payment_intent_data[metadata][ein]'] = '91-1167420';
    payload['payment_intent_data[description]'] = 'WSSAR Conference Registration (includes $' + donationAmount.toFixed(2) + ' tax-deductible donation, EIN 91-1167420)';
  }

  // Add CC fee as final line item
  var subtotal = 0;
  for (var i = 0; i < items.length; i++) subtotal += items[i].amount;
  var feeAmount = stripeAmount - subtotal;
  if (feeAmount > 0) {
    items.push({ name: 'Credit Card Processing Fee', amount: feeAmount });
  }

  for (var idx = 0; idx < items.length; idx++) {
    var prefix = 'line_items[' + idx + ']';
    payload[prefix + '[price_data][currency]'] = 'usd';
    payload[prefix + '[price_data][unit_amount]'] = items[idx].amount.toString();
    payload[prefix + '[price_data][product_data][name]'] = items[idx].name;
    if (items[idx].description) {
      payload[prefix + '[price_data][product_data][description]'] = items[idx].description;
    }
    payload[prefix + '[quantity]'] = '1';
  }

  var response = UrlFetchApp.fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'post',
    headers: { 'Authorization': 'Basic ' + Utilities.base64Encode(secretKey + ':') },
    payload: payload,
    muteHttpExceptions: true
  });

  var session = JSON.parse(response.getContentText());
  return session.url || '';
  } catch (e) {
    Logger.log('Stripe error: ' + e.message);
    return '';
  }
}

function buildLineItems(formData) {
  var pricing = getPricing();
  var items = [];

  // Registration + Meals combined
  var regCount = Number(formData.registrationCount) || 1;
  var regPrice = pricing['Registration'] ? pricing['Registration'].price : 15;
  var regMealTotal = regCount * regPrice;
  if (formData.meals) {
    for (var event in formData.meals) {
      regMealTotal += Number(formData.meals[event].price) || 0;
    }
  }
  var guests = formData.guests || [];
  for (var i = 0; i < guests.length; i++) {
    if (guests[i].meals) {
      for (var gEvent in guests[i].meals) {
        regMealTotal += Number(guests[i].meals[gEvent].price) || 0;
      }
    }
  }
  if (regMealTotal > 0) {
    items.push({ name: 'Registration & Meals', amount: regMealTotal * 100 });
  }

  // Raffle tickets
  var raffleCount = Number(formData.raffleTickets) || 0;
  var rafflePrice = pricing['Raffle Tickets'] ? pricing['Raffle Tickets'].price : 25;
  var raffleTotal = raffleCount * rafflePrice;
  if (raffleTotal > 0) {
    items.push({ name: 'Raffle Tickets (' + raffleCount + ')', amount: raffleTotal * 100 });
  }

  // Donation
  if (formData.donation) {
    var donationAmount = 0;
    var donationPricing = pricing[formData.donation];
    if (donationPricing) {
      donationAmount = donationPricing.price;
    } else {
      donationAmount = Number(formData.donation) || 0;
    }
    if (donationAmount > 0) {
      var config = getAllConfig();
      var donationNote = config['DonationNote'] || 'Tax-deductible. EIN: 91-1167420';
      items.push({
        name: 'Donation — $' + donationAmount.toFixed(2) + ' tax-deductible',
        amount: donationAmount * 100,
        description: donationNote
      });
    }
  }

  return items;
}

/**
 * Stripe webhook handler. Called via doPost() when Stripe sends a
 * checkout.session.completed event.
 *
 * To set up:
 * 1. Deploy this script as a web app
 * 2. In Stripe Dashboard > Webhooks, add the web app URL
 * 3. Select "checkout.session.completed" event
 * 4. Copy the webhook signing secret to the Config sheet as "StripeWebhookSecret"
 */
function handleStripeWebhook(postData) {
  try {
    var event = JSON.parse(postData);

    if (event.type !== 'checkout.session.completed') {
      return { status: 'ignored', type: event.type };
    }

    var session = event.data.object;
    var registrationId = session.client_reference_id;
    var amountPaid = session.amount_total / 100;
    var payerEmail = session.customer_details ? session.customer_details.email : '';

    if (!registrationId) {
      return { status: 'error', message: 'No client_reference_id' };
    }

    // Get payment method details (card brand + last4)
    var paymentLabel = 'Card';
    try {
      var piId = session.payment_intent;
      if (piId) {
        var testMode = String(getConfigValue('StripeTestMode')).trim().toUpperCase();
        var propKey = (testMode === 'TRUE') ? 'STRIPE_TEST_KEY' : 'STRIPE_SECRET_KEY';
        var secretKey = PropertiesService.getScriptProperties().getProperty(propKey);
        if (secretKey) {
          var piResp = UrlFetchApp.fetch('https://api.stripe.com/v1/payment_intents/' + piId + '?expand[]=latest_charge', {
            headers: { 'Authorization': 'Basic ' + Utilities.base64Encode(secretKey + ':') },
            muteHttpExceptions: true
          });
          var pi = JSON.parse(piResp.getContentText());
          var charge = null;
          if (pi.latest_charge && typeof pi.latest_charge === 'object') {
            charge = pi.latest_charge;
          } else if (pi.charges && pi.charges.data && pi.charges.data[0]) {
            charge = pi.charges.data[0];
          }
          if (charge && charge.payment_method_details && charge.payment_method_details.card) {
            var card = charge.payment_method_details.card;
            paymentLabel = (card.brand || 'Card').charAt(0).toUpperCase() + (card.brand || '').slice(1) + ' ' + card.last4;
          }
        }
      }
    } catch(e) {
      Logger.log('Could not fetch card details: ' + e.message);
    }

    // Record payment
    var paymentSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Payments');
    paymentSheet.appendRow([
      new Date(),
      registrationId,
      'Stripe',
      amountPaid,
      payerEmail,
      session.payment_intent || session.id
    ]);

    // Update registration status
    updatePaymentStatus(registrationId, 'Paid - ' + paymentLabel, amountPaid);

    return { status: 'ok', registrationId: registrationId };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}

function updatePaymentStatus(registrationId, status, amount) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Registrations');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var regIdCol = headers.indexOf('RegistrationID');
  var statusCol = headers.indexOf('PaymentStatus');
  var paidAmtCol = headers.indexOf('AmountPaid');

  for (var i = 1; i < data.length; i++) {
    if (data[i][regIdCol] === registrationId) {
      sheet.getRange(i + 1, statusCol + 1).setValue(status);
      if (paidAmtCol >= 0 && amount) {
        sheet.getRange(i + 1, paidAmtCol + 1).setValue(amount);
      }
      return true;
    }
  }
  return false;
}

/**
 * Manual payment recording (for Zelle/check).
 * Called from the admin or status page.
 */
function recordManualPayment(registrationId, method, amount, notes) {
  var paymentSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Payments');
  paymentSheet.appendRow([
    new Date(),
    registrationId,
    method,
    amount,
    notes || '',
    ''
  ]);
  updatePaymentStatus(registrationId, 'Paid - ' + method, amount);
  return { status: 'ok' };
}
