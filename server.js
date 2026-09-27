import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const PROXY_SECRET = process.env.PROXY_SECRET_KEY;

// Enable CORS and JSON body parsing (50mb limit for base64 image data payloads)
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Middleware for basic authentication check (Optional, recommended)
app.use((req, res, next) => {
  if (PROXY_SECRET) {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${PROXY_SECRET}`) {
      return res.status(401).json({ error: { message: "Unauthorized proxy request." } });
    }
  }
  next();
});

/**
 * Dynamic Wildcard Proxy Endpoint
 * Forwards requests from: /v1beta/models/*
 * To: https://generativelanguage.googleapis.com/v1beta/models/*
 */
app.post('/v1beta/models/*', async (req, res) => {
  try {
    // Extract the full path after /v1beta/models/
    const targetPath = req.params[0];
    const apiKey = req.query.key;

    if (!apiKey) {
      return res.status(400).json({ error: { message: "Missing Google Gemini API key parameter." } });
    }

    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetPath}?key=${apiKey}`;

    // Forward the request payload to Google AI Studio
    const googleResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    const data = await googleResponse.json();

    // Relay Google's status code and response payload back to the client
    return res.status(googleResponse.status).json(data);
  } catch (error) {
    console.error('Gemini Proxy Error:', error);
    return res.status(500).json({
      error: {
        message: 'Failed to process request through proxy.',
        details: error.message,
      },
    });
  }
});

// Health check route
app.get('/health', (req, res) => {
  res.status(200).send('Gemini Proxy is online.');
});

app.listen(PORT, () => {
  console.log(`Gemini Proxy running on port ${PORT}`);
});
