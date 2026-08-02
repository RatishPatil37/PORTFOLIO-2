export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        // raw body
      }
    }
    body = body || {};

    const { message, history } = body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'API key not configured. Please set GEMINI_API_KEY in Vercel Environment Variables.' 
      });
    }

    // System prompt with full RAG knowledge context about Ratish Patil
    const systemInstruction = `You are "Ask Ratish AI", a friendly, professional AI Assistant representing Ratish Patil on his personal portfolio website.

FACTS ABOUT RATISH PATIL:
- Identity: Final-year B.E. AI & Data Science student at SIES Graduate School of Technology, Navi Mumbai (CGPA: 9.26).
- Primary Focus: AI Architect, LLM Pipelines, Agentic AI, Advanced RAG, Edge Computer Vision, Local LLMs, and Full-Stack Engineering.
- Email: patilratish369@gmail.com
- GitHub: https://github.com/RatishPatil37
- LinkedIn: https://linkedin.com/in/ratish-patil

PROJECTS:
1. KrishiSetu (Jan 2026 - Present):
   - Custom YOLOv8-cls model trained on 22K+ images (24 crop diseases, 98% accuracy on CPU).
   - Multilingual conversational AI voice assistant enabling hands-free navigation & scheme eligibility checks.
   - Automated OCR pipeline for 7/12 land records integrated with LLM matchmaker & RAG workflow for PDF reports.
   - Live Demo: https://krishisetu-4b5y.onrender.com/ | GitHub: https://github.com/RatishPatil37/KRISHISETU

2. Smart Sight (Aug 2025 - Nov 2025):
   - Standalone multimodal Edge-AI device for visually impaired on Raspberry Pi 4B (4GB RAM).
   - YOLOv4-tiny + OpenCV for obstacle detection (10 FPS), Tesseract OCR for text reading.
   - Offline voice assistant running TinyLlama and faster_whisper completely on-device.
   - CloudCam feature syncing photos to Microsoft OneDrive. GitHub: https://github.com/RatishPatil37/SmartSight

3. Review Insight Navigator (Feb 2025 - Apr 2025):
   - Scraped 30+ Amazon product listings using BeautifulSoup & Selenium.
   - NLP sentiment classification (85% accuracy) using Scikit-Learn & Streamlit UI.

4. IoT Vehicle Tracker (Mar 2026 - Present):
   - Edge tracking system with Raspberry Pi 4B, NEO-M8N GPS, and LTE modem.
   - <1s upload latency to Firebase Realtime Database with 5s GPS refresh cycle.

KEY SKILLS:
- AI/ML/CV: Python, PyTorch, Scikit-learn, OpenCV, YOLO, Tesseract OCR, Ollama, LangChain concepts.
- Web/Backend: React.js, Node.js, Express.js, FastAPI, HTML5/CSS3.
- Cloud/DB: Firebase, Supabase, PostgreSQL, MongoDB, Docker, Vercel.
- Hardware/IoT: Raspberry Pi 4B, GPIO, GPS (NEO-M8N), LTE.

BEHAVIOR RULES:
- Talk naturally, concise, human-like (2 to 3 sentences max).
- Refer to yourself as Ratish's AI Assistant.
- If asked off-topic questions (e.g. recipes, weather, general trivia), politely reply that you are specialized in answering questions about Ratish's AI engineering work, projects, and skills.
- If asked for information not in your context, say Ratish hasn't indexed that specific detail yet, but invite them to contact him at patilratish369@gmail.com.`;

    const contents = [];
    if (Array.isArray(history)) {
      history.forEach(item => {
        if (item.role && item.parts) {
          contents.push(item);
        }
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    // Gemini 3.x models in priority order based on AI Studio dashboard limits
    const gemini3Models = [
      { ids: ['gemini-3.5-flash-lite', 'gemini-3-5-flash-lite'], label: 'Gemini 3.5 Flash Lite' },
      { ids: ['gemini-3.1-flash-lite', 'gemini-3-1-flash-lite'], label: 'Gemini 3.1 Flash Lite' },
      { ids: ['gemini-3.6-flash', 'gemini-3-6-flash'],           label: 'Gemini 3.6 Flash' },
      { ids: ['gemini-3.5-flash', 'gemini-3-5-flash'],           label: 'Gemini 3.5 Flash' },
      { ids: ['gemini-3-flash'],                                 label: 'Gemini 3 Flash' }
    ];

    const apiVersions = ['v1beta', 'v1alpha'];
    let lastError = null;
    let replyText = null;
    let successfulModelLabel = 'Gemini 3.5 Flash Lite';

    for (const ver of apiVersions) {
      for (const modelConfig of gemini3Models) {
        for (const modelId of modelConfig.ids) {
          const endpoint = `https://generativelanguage.googleapis.com/${ver}/models/${modelId}:generateContent?key=${apiKey}`;
          try {
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                systemInstruction: {
                  parts: [{ text: systemInstruction }]
                },
                contents: contents,
                generationConfig: {
                  temperature: 0.7,
                  maxOutputTokens: 220
                }
              })
            });

            const data = await response.json();
            if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
              replyText = data.candidates[0].content.parts[0].text;
              successfulModelLabel = modelConfig.label;
              break;
            } else {
              lastError = data.error?.message || JSON.stringify(data);
              console.warn(`Attempt ${ver}/${modelId} failed:`, lastError);
            }
          } catch (e) {
            lastError = e.message;
          }
        }
        if (replyText) break;
      }
      if (replyText) break;
    }

    if (replyText) {
      return res.status(200).json({ 
        reply: replyText, 
        modelUsed: successfulModelLabel 
      });
    } else {
      return res.status(500).json({ 
        error: `Gemini 3.x API Error: ${lastError || 'Service temporarily busy'}` 
      });
    }

  } catch (err) {
    console.error('Serverless Function Exception:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
