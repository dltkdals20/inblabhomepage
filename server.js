const express = require('express');
const cors = require('cors');
// ✅ 슈퍼베이스 라이브러리 추가
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;

// ✅ 슈퍼베이스 연결 설정
// Railway Variables에 이 값들이 꼭 있어야 합니다.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log("✅ Supabase Connected!");
} else {
  console.warn("⚠️ Warning: SUPABASE_URL or SUPABASE_KEY is missing.");
}

const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
let corsOptions;

if (allowedOriginsEnv) {
  const allowedOrigins = allowedOriginsEnv
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  corsOptions = {
    origin(origin, callback) {
      if (!origin) return callback(null, true); 
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
  res.json({ ok: true, db: supabase ? "connected" : "disconnected" });
});

// 1. 기존 채팅 세션 발급 (유지)
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

// ✅ 2. [업그레이드] 검색어 통계 -> 슈퍼베이스 저장
app.post('/api/chatkit/log', async (req, res) => {
  try {
    const { user, query, type } = req.body;
    
    // 로그는 일단 콘솔에도 찍고
    console.log(`[LOG] User:${user} | Query:${query}`);

    // 슈퍼베이스가 연결되어 있다면 DB에 저장
    if (supabase) {
      const { error } = await supabase
        .from('chat_logs') // 아까 만든 테이블 이름
        .insert([
          { 
            user_id: user, 
            query: query, 
            type: type || 'click' 
          }
        ]);
      
      if (error) {
        console.error("Supabase Insert Error:", error);
        return res.status(500).json({ error: error.message });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Log error:", error);
    res.status(500).json({ error: "Logging failed" });
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
  console.log(`Server listening on port ${port}`);
});