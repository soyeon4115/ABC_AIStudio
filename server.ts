import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { booksData, Book } from "./src/booksData";

dotenv.config();

const app = express();
const PORT = 3000;

// JSON parser
app.use(express.json());

// Initialize Gemini SDK with telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Simple RAG Search engine: Retrieves relevant books based on the user's query
function retrieveRelevantBooks(query: string, limit: number = 8): Book[] {
  if (!query || query.trim() === "") {
    return booksData.slice(0, limit);
  }

  const queryTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  
  const scoredBooks = booksData.map(book => {
    let score = 0;
    const textToSearch = `${book.title} ${book.author} ${book.publisher} ${book.date}`.toLowerCase();
    
    // Exact phrase match gets a high boost
    if (textToSearch.includes(query.toLowerCase())) {
      score += 10;
    }

    // Individual token matches
    queryTokens.forEach(token => {
      if (textToSearch.includes(token)) {
        score += 2;
        // Prefix match boost
        if (book.title.toLowerCase().startsWith(token)) {
          score += 3;
        }
      }
    });

    // Rank boost (highly ranked books get a slight preference in ambiguity)
    score += (150 - book.rank) * 0.01;

    return { book, score };
  });

  // Filter out zero score if query token doesn't match anything, or sort and slice
  return scoredBooks
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.book)
    .slice(0, limit);
}

// 1. API: Get all books
app.get("/api/books", (req, res) => {
  try {
    const publisher = req.query.publisher as string;
    const search = req.query.search as string;
    
    let filtered = [...booksData];

    if (publisher) {
      filtered = filtered.filter(b => b.publisher === publisher);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(b => 
        b.title.toLowerCase().includes(searchLower) || 
        b.author.toLowerCase().includes(searchLower) ||
        b.publisher.toLowerCase().includes(searchLower)
      );
    }

    res.json({
      success: true,
      books: filtered,
      total: filtered.length
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. API: RAG Chat Chatbot
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, userQuery } = req.body;

    if (!userQuery) {
      return res.status(400).json({ success: false, error: "Query is required" });
    }

    // 1. Retrieve the most relevant books from our curated local dataset (RAG retrieval)
    const retrievedBooks = retrieveRelevantBooks(userQuery, 6);

    // 2. Formulate context details
    const contextString = retrievedBooks.map((b, idx) => {
      return `[도서 ${idx + 1}]
순위: ${b.rank}위
제목: ${b.title}
저자: ${b.author}
출판사: ${b.publisher}
출간일: ${b.date}
판매가: ${b.price.toLocaleString()}원 (정가: ${b.originalPrice.toLocaleString()}원, 할인율: ${b.discount}%)
상세 링크: ${b.link}
이미지 URL: ${b.image}
------------------------`;
    }).join("\n");

    // 3. Prepare system instruction
    const systemInstruction = `당신은 사용자의 요청에 딱 맞춤형으로 도서를 추천하고 정보를 제공하는 "도서 추천 전문 AI 어시스턴트(RAG)"입니다.
아래에 제공된 [참고 도서 컨텍스트] 데이터를 절대적이고 최신의 사실로 삼아 답변을 구성하십시오.

[작성 및 추천 규칙]
1. 반드시 친절하고 정중한 한국어로 대답해 주세요.
2. 답변에서 도서를 언급하거나 추천할 때는 해당 도서의 [제목], [저자], [출판사], [판매가]를 명확히 언급해 주세요.
3. 책을 추천할 때 해당 도서의 '상세 링크'도 마크다운 형식([도서 보러가기](상세링크))으로 함께 반드시 제공해 주어 사용자가 직접 예스24 상품 페이지로 바로 갈 수 있게 하십시오.
4. 사용자가 찾으려는 도서에 맞는 책이 컨텍스트에 없다면 솔직히 언급한 뒤, 가장 유사한 분야(AI 활용법, 바이브 코딩, 교사 에듀테크, 엑셀/영상 편집 등)의 책을 차선책으로 풍부하게 권해주세요.
5. 절대 거짓 정보(환각 현상)를 지어내어 생성하지 마십시오. 오직 아래 주어진 컨텍스트 속의 책들만 완벽한 진실로 간주해야 합니다.`;

    // 4. Formulate messages parameter for Gemini
    const prompt = `사용자 질문: "${userQuery}"

[참고 도서 컨텍스트] (사용자의 질문과 관련된 우리 데이터베이스의 검색 결과입니다):
${contextString || "관련된 직접적인 데이터가 없습니다. 전반적인 도서 목록에서 적절히 추천해 주세요."}

이전 대화 맥락이 있는 경우 참고하여 사용자의 질문에 최고의 맞춤형 추천과 도서 정보를 생성해 주세요.`;

    // 5. Call Gemini API
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    const aiMessage = response.text || "답변을 생성하지 못했습니다.";

    res.json({
      success: true,
      message: aiMessage,
      retrievedBooks: retrievedBooks // Frontend can highlight or list these separately
    });
  } catch (error: any) {
    console.error("Gemini API Error in Server:", error);
    res.status(500).json({ success: false, error: error.message || "Internal server error" });
  }
});

// Vite Middleware for Full-stack Setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
