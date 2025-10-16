const crypto = require('crypto');

module.exports = async (req, res) => {
  // CORS Headers für Make.com
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
    const { token, secret, request } = req.body;

    // Validierung
    if (!token || !secret || !request) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['token', 'secret', 'request']
      });
    }

    // Aktuellen Timestamp generieren
    const timestamp = Math.floor(Date.now() / 1000);

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

    // onOffice API aufrufen
    const onofficeResponse = await fetch('https://api.onoffice.de/api/stable/api.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(onofficeRequest)
    });

    const responseData = await onofficeResponse.json();

    // Response an Make.com zurückgeben
    return res.status(200).json({
      success: true,
      timestamp: timestamp,
      data: responseData
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};
```

---

## **ORDNERSTRUKTUR:**
```
onoffice-middleware/
├── api/
│   └── onoffice.js          ← JavaScript Code (oben)
└── package.json              ← JSON Config (oben)
