const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
let corsOptions;

if (allowedOriginsEnv) {
  const allowedOrigins = allowedOriginsEnv
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  corsOptions = {
    origin(origin, callback) {
      if (!origin) return callback(null, true); // allow tools like curl/Postman
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
  };
} else {
  corsOptions = { origin: true };
}

app.use(cors(corsOptions));
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/chatkit/session', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const workflowId = process.env.CHATKIT_WORKFLOW_ID;

  if (!apiKey || !workflowId) {
    return res.status(500).json({ error: 'Missing env vars' });
  }

  const user = req.body && req.body.user ? String(req.body.user) : 'anonymous';
  const payload = {
    user,
    workflow: { id: workflowId },
  };

  try {
    const response = await fetch('https://api.openai.com/v1/chatkit/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'OpenAI-Beta': 'chatkit_beta=v1',
      },
      body: JSON.stringify(payload),
    });

    let data;
    try {
      data = await response.json();
    } catch (_err) {
      data = { error: 'Invalid JSON from upstream' };
    }

    if (response.ok) {
      return res.json({ client_secret: data.client_secret });
    }

    return res.status(response.status).json(data);
  } catch (err) {
    console.error('OpenAI request failed', err);
    return res.status(500).json({ error: 'Upstream request failed' });
  }
});

app.use((err, _req, res, _next) => {
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  console.error('Unhandled error', err);
  return res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log('TEST_VAR:', process.env.TEST_VAR);
  console.log('Env status', {
    openaiApiKeyPresent: Boolean(process.env.OPENAI_API_KEY),
    chatkitWorkflowIdPresent: Boolean(process.env.CHATKIT_WORKFLOW_ID),
    allowedOriginsConfigured: Boolean(allowedOriginsEnv),
  });
  console.log(`Server listening on port ${port}`);
});
