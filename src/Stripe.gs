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

function createStripeUrl(stripeAmount, registrationId, email) {
  var baseUrl = getConfigValue('StripePaymentLink');
  if (!baseUrl) return '';
  return baseUrl +
    '?client_reference_id=' + registrationId +
    '&prefilled_email=' + encodeURIComponent(email);
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
    updatePaymentStatus(registrationId, 'Paid - Stripe', amountPaid);

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
