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
const assistantId = process.env.ASSISTANT_ID; // 🔥 Railway에 등록한 그 ID (asst_...)

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
  console.error("❌ Error: OPENAI_API_KEY Missing");
}

if (!assistantId) {
  console.error("❌ Error: ASSISTANT_ID Missing (Variables 확인 필요)");
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

// 4. [핵심 변경] 에이전트(Assistants API) 실행 로직
app.post('/api/chat/message', async (req, res) => {
  const { user, message } = req.body;

  try {
    // A. 사용자 질문 저장 (DB)
    if (supabase) {
      await supabase.from('chat_history').insert([
        { user_id: user, query: message, type: 'user_question' }
      ]);
    }

    if (!openai || !assistantId) throw new Error("OpenAI or Assistant ID not configured");

    console.log(`🤖 에이전트 실행 시작... (ID: ${assistantId})`);

    // B. 스레드 생성 및 실행 (Create and Run)
    // 질문을 던지고, 파일 검색이 끝날 때까지 기다립니다.
    const run = await openai.beta.threads.createAndRunPoll({
      assistant_id: assistantId,
      thread: {
        messages: [
          { role: "user", content: message },
        ],
      },
    });

    let aiResponse = "";

    // C. 답변 가져오기
    if (run.status === 'completed') {
      const messages = await openai.beta.threads.messages.list(
        run.thread_id
      );
      
      // 가장 최근 메시지(AI 답변) 찾기
      const lastMessage = messages.data.find(m => m.role === 'assistant');
      
      if (lastMessage && lastMessage.content[0].type === 'text') {
        aiResponse = lastMessage.content[0].text.value;
        
        // 🧹 지저분한 출처 표시(【4:0†source】) 제거하기
        aiResponse = aiResponse.replace(/【.*?】/g, ''); 
      }
    } else {
      aiResponse = "죄송합니다. 답변을 생성하는 데 실패했습니다. (Status: " + run.status + ")";
    }

    // D. AI 답변 저장 (DB)
    if (supabase) {
      await supabase.from('chat_history').insert([
        { user_id: user, query: aiResponse, type: 'ai_answer' }
      ]);
    }

    // E. 결과 반환
    res.json({ reply: aiResponse });

  } catch (error) {
    console.error("Agent Error:", error);
    res.status(500).json({ error: "Server Error" });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});