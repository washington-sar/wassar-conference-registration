const https = require('https');

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyRu1YlnDGku8YpPGjllc8QuXtZtt7tnnYqgePLvZIb_wPJQeH7TK-TU2OwHUFp4U2x/exec';

exports.stripeWebhookProxy = (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const url = new URL(APPS_SCRIPT_URL);

  const options = {
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  };

  const forward = https.request(options, (response) => {
    // Follow the 302 redirect
    if (response.statusCode === 302 && response.headers.location) {
      const redirectUrl = new URL(response.headers.location);
      const redirectOptions = {
        hostname: redirectUrl.hostname,
        path: redirectUrl.pathname + redirectUrl.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      };
      const redirect = https.request(redirectOptions, (finalRes) => {
        let data = '';
        finalRes.on('data', (chunk) => { data += chunk; });
        finalRes.on('end', () => { res.status(200).send(data); });
      });
      redirect.on('error', () => { res.status(200).send('{"status":"forwarded"}'); });
      redirect.write(body);
      redirect.end();
    } else {
      res.status(200).send('{"status":"ok"}');
    }
  });

  forward.on('error', () => { res.status(200).send('{"status":"error"}'); });
  forward.write(body);
  forward.end();
};
