const crypto = require('crypto');
const https = require('https');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Nur POST erlaubt
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    // Body parsen
    const { token, secret, request, timestampOffset } = req.body;

    // Validierung
    if (!token || !secret || !request) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['token', 'secret', 'request'],
        received: {
          token: !!token,
          secret: !!secret,
          request: !!request
        }
      });
    }

    // Aktuellen Timestamp generieren mit optionalem Offset
    // timestampOffset kann positive oder negative Sekunden sein (z.B. -7200 für -2 Stunden)
    const offset = timestampOffset || 0;
    const timestamp = Math.floor(Date.now() / 1000) + offset;

    // HMAC berechnen
    const hmacInput = timestamp + JSON.stringify({
      token: token,
      request: request
    });

    const hmac = crypto
      .createHmac('sha256', secret)
      .update(hmacInput)
      .digest('hex');

    // Kompletten Request Body für onOffice erstellen
    const onofficeRequest = {
      token: token,
      request: request,
      hmac: hmac,
      hmacversion: '2',
      timestamp: timestamp
    };

    const requestBody = JSON.stringify(onofficeRequest);

    // onOffice API mit https Modul aufrufen
    const responseData = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.onoffice.de',
        path: '/api/stable/api.php',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody)
        }
      };

      const apiReq = https.request(options, (apiRes) => {
        let data = '';

        apiRes.on('data', (chunk) => {
          data += chunk;
        });

        apiRes.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (e) {
            reject(new Error('Invalid JSON response from onOffice API'));
          }
        });
      });

      apiReq.on('error', (error) => {
        reject(error);
      });

      apiReq.write(requestBody);
      apiReq.end();
    });

    // Response an Make.com zurückgeben
    return res.status(200).json({
      success: true,
      timestamp: timestamp,
      timestampOffset: offset,
      data: responseData
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
