const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');

const app = express();
const port = process.env.PORT || 3000;

// 1. 환경변수 가져오기
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

// 2. 연결 설정
let supabase;
let openai;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log("✅ Supabase Connected!");
}

if (openaiApiKey) {
  openai = new OpenAI({ apiKey: openaiApiKey });
  console.log("✅ OpenAI Connected!");
} else {
  console.error("❌ Error: OPENAI_API_KEY is missing in Railway Variables!");
}

// 3. CORS 설정
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOriginsEnv && allowedOriginsEnv.includes(origin)) return callback(null, true);
    return callback(null, true);
  }
}));
app.use(express.json());

// 4. 채팅 API (자체 UI 연동용)
app.post('/api/chat/message', async (req, res) => {
  const { user, message } = req.body;

  try {
    // A. 질문 저장 (chat_history 테이블)
    if (supabase) {
      await supabase.from('chat_history').insert([
        { user_id: user, query: message, type: 'user_question' }
      ]);
    }

    // B. AI 답변 요청
    if (!openai) throw new Error("OpenAI Not Initialized");

    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "당신은 Inblab의 비즈니스 코칭 및 교육 전문 상담 봇입니다. 한국어로 친절하고 명확하게 답변하세요." },
        { role: "user", content: message }
      ],
      model: "gpt-4o", // 모델 설정 (gpt-4o 또는 gpt-3.5-turbo)
    });

    const aiResponse = completion.choices[0].message.content;

    // C. 답변 저장 (chat_history 테이블)
    if (supabase) {
      await supabase.from('chat_history').insert([
        { user_id: user, query: aiResponse, type: 'ai_answer' }
      ]);
    }

    // D. 답변 반환
    res.json({ reply: aiResponse });

  } catch (error) {
    console.error("Chat Error:", error);
    res.status(500).json({ error: "Server Error" });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});