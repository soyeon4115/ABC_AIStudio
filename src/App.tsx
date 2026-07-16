import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  BookOpen,
  PieChart,
  MessageSquare,
  Search,
  BookMarked,
  ArrowUpDown,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Tag,
  DollarSign,
  Info,
  Send,
  Sparkles,
  RefreshCw,
  Award,
  Lightbulb,
  FileText
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  AreaChart,
  Area
} from "recharts";
import { booksData, Book } from "./booksData";

// Custom Minimal Markdown and Link Parser to render Gemini's response safely and elegantly.
const MarkdownRenderer = ({ text }: { text: string }) => {
  if (!text) return null;

  // Process line by line
  const lines = text.split("\n");
  
  return (
    <div className="space-y-2 text-slate-700 leading-relaxed font-sans text-sm md:text-base">
      {lines.map((line, idx) => {
        let cleanLine = line.trim();
        
        // Headers
        if (cleanLine.startsWith("###")) {
          return <h4 key={idx} className="text-base font-semibold text-slate-900 mt-4 mb-1">{cleanLine.replace("###", "").trim()}</h4>;
        }
        if (cleanLine.startsWith("##")) {
          return <h3 key={idx} className="text-lg font-bold text-slate-900 mt-5 mb-2 border-b border-slate-100 pb-1">{cleanLine.replace("##", "").trim()}</h3>;
        }
        if (cleanLine.startsWith("#")) {
          return <h2 key={idx} className="text-xl font-extrabold text-indigo-700 mt-6 mb-3">{cleanLine.replace("#", "").trim()}</h2>;
        }

        // Bullet lists
        if (cleanLine.startsWith("-") || cleanLine.startsWith("*")) {
          const listText = cleanLine.substring(1).trim();
          return (
            <ul key={idx} className="list-disc pl-5 space-y-1 my-1">
              <li>{parseInlineMarkdown(listText)}</li>
            </ul>
          );
        }

        // Numbered lists
        const numMatch = cleanLine.match(/^(\d+)\.\s(.*)/);
        if (numMatch) {
          const listText = numMatch[2];
          return (
            <ol key={idx} className="list-decimal pl-5 space-y-1 my-1">
              <li>{parseInlineMarkdown(listText)}</li>
            </ol>
          );
        }

        // Regular paragraphs
        if (cleanLine === "") {
          return <div key={idx} className="h-2" />;
        }

        return <p key={idx} className="my-1">{parseInlineMarkdown(line)}</p>;
      })}
    </div>
  );
};

// Sub-parser for inline Markdown like **bold** and [link text](url)
const parseInlineMarkdown = (text: string) => {
  // Regex to split by links and bold patterns
  // Pattern 1: **bold**
  // Pattern 2: [label](url)
  const parts: React.ReactNode[] = [];
  let currentIdx = 0;

  // We do a simple manual tokenization for links & bold tags
  const boldRegex = /\*\*(.*?)\*\*/g;
  const linkRegex = /\[(.*?)\]\((.*?)\)/g;

  // Combining them simply
  // 1. Convert link syntax to safe placeholders
  // 2. Convert bold syntax to safe placeholders
  // For robustness, we can do a simplified regex search.
  
  // Let's implement a very simple loop to detect links and bold segments.
  let remainingText = text;
  
  // Quick check if there are no markdown patterns
  if (!text.includes("**") && !text.includes("[")) {
    return text;
  }

  // Safe split & map for **bold** first
  const boldSplit = text.split(/\*\*/g);
  return boldSplit.map((part, index) => {
    // Odd indices are bold
    if (index % 2 !== 0) {
      return <strong key={index} className="font-bold text-slate-900 bg-indigo-50 px-1 rounded">{parseLinks(part)}</strong>;
    }
    return parseLinks(part);
  });
};

const parseLinks = (text: string) => {
  const linkRegex = /\[(.*?)\]\((.*?)\)/g;
  const matches = [...text.matchAll(linkRegex)];
  if (matches.length === 0) {
    return text;
  }

  const result: React.ReactNode[] = [];
  let lastIndex = 0;

  matches.forEach((match, idx) => {
    const matchIndex = match.index || 0;
    // Add text before match
    if (matchIndex > lastIndex) {
      result.push(text.substring(lastIndex, matchIndex));
    }
    
    const label = match[1];
    const url = match[2];
    
    result.push(
      <a
        key={idx}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium underline decoration-indigo-300 hover:decoration-indigo-600 transition-all"
      >
        {label}
        <ExternalLink className="w-3 h-3" />
      </a>
    );
    lastIndex = matchIndex + match[0].length;
  });

  if (lastIndex < text.length) {
    result.push(text.substring(lastIndex));
  }

  return result;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "chatbot" | "explorer">("dashboard");

  // Filter States for Book Explorer
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPublisherFilter, setSelectedPublisherFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"rank" | "price" | "discount">("rank");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Chatbot states
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant" | "system"; text: string }>>([
    {
      role: "assistant",
      text: "안녕하세요! 👋 도서 종합 분석 데이터를 탑재한 스마트 AI 추천 챗봇입니다. 어떤 책을 찾으시나요?\n예를 들어, **'초보자를 위한 파이썬 책 추천해줘'**, **'클로드 코딩에 관한 책은 어떤 게 있어?'**, **'학교 수업에 쓸만한 에듀테크나 인공지능 책 추천해줘'** 라고 물어보세요! 상세한 순위, 가격 및 직접 구매 가능한 링크를 매칭하여 친절히 설명해 드릴게요."
    }
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatbotRetrievedBooks, setChatbotRetrievedBooks] = useState<Book[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new chat messages
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isChatLoading]);

  // Compute stats for Dashboard
  const stats = useMemo(() => {
    const totalCount = booksData.length;
    const avgPrice = Math.round(booksData.reduce((acc, curr) => acc + curr.price, 0) / totalCount);
    
    // Most expensive / cheapest
    const sortedByPrice = [...booksData].sort((a, b) => b.price - a.price);
    const mostExpensive = sortedByPrice[0];
    const cheapest = sortedByPrice[sortedByPrice.length - 1];

    // Publisher share
    const publisherMap: Record<string, number> = {};
    booksData.forEach(b => {
      publisherMap[b.publisher] = (publisherMap[b.publisher] || 0) + 1;
    });

    const publishersData = Object.entries(publisherMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const topPublishers = publishersData.slice(0, 5);
    const otherPublishersCount = publishersData.slice(5).reduce((acc, curr) => acc + curr.count, 0);
    if (otherPublishersCount > 0) {
      topPublishers.push({ name: "기타", count: otherPublishersCount });
    }

    // Keyword theme analysis based on titles
    const themes = [
      { name: "클로드(Claude)", keywords: ["클로드", "claude"] },
      { name: "제미나이(Gemini)", keywords: ["제미나이", "gemini"] },
      { name: "챗GPT(ChatGPT)", keywords: ["챗gpt", "gpt", "gpts"] },
      { name: "바이브 코딩", keywords: ["바이브 코딩", "바이브 코더"] },
      { name: "교사/에듀테크", keywords: ["교사", "에듀테크", "학교", "수업", "선생님"] },
      { name: "엑셀/오피스", keywords: ["엑셀", "오피스", "스프레드시트", "워드", "한글"] },
      { name: "영상 편집/유튜브", keywords: ["캡컷", "영상 편집", "프리미어", "유튜브", "쇼츠", "릴스"] },
      { name: "디자인/피그마/캔바", keywords: ["디자인", "피그마", "캔바", "일러스트", "포토샵"] },
      { name: "프로그래밍 기초", keywords: ["파이썬", "python", "c 언어", "c++", "자바", "java"] },
      { name: "AI 에이전트/LLM", keywords: ["에이전트", "llm", "랭체인", "langchain", "랭그래프", "rag"] }
    ];

    const themeCounts = themes.map(t => {
      const count = booksData.filter(b => {
        const titleLower = b.title.toLowerCase();
        return t.keywords.some(keyword => titleLower.includes(keyword));
      }).length;
      return { name: t.name, count };
    }).sort((a, b) => b.count - a.count);

    // Price brackets
    const priceBrackets = [
      { range: "1.5만원 이하", count: booksData.filter(b => b.price <= 15000).length },
      { range: "1.5만 ~ 2만원", count: booksData.filter(b => b.price > 15000 && b.price <= 20000).length },
      { range: "2만 ~ 2.5만원", count: booksData.filter(b => b.price > 20000 && b.price <= 25000).length },
      { range: "2.5만 ~ 3만원", count: booksData.filter(b => b.price > 25000 && b.price <= 30000).length },
      { range: "3만원 초과", count: booksData.filter(b => b.price > 30000).length }
    ];

    // Discounts
    const discountData = [
      { name: "할인 없음 (0%)", count: booksData.filter(b => b.discount === 0).length },
      { name: "5% 할인", count: booksData.filter(b => b.discount === 5).length },
      { name: "10% 할인", count: booksData.filter(b => b.discount === 10).length }
    ];

    return {
      totalCount,
      avgPrice,
      mostExpensive,
      cheapest,
      topPublishers,
      themeCounts,
      priceBrackets,
      discountData,
      publisherList: Object.keys(publisherMap).sort()
    };
  }, []);

  // Filtered & Sorted books for Book Explorer
  const filteredBooks = useMemo(() => {
    return booksData
      .filter(book => {
        const matchSearch =
          book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
          book.publisher.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchPublisher =
          selectedPublisherFilter === "all" || book.publisher === selectedPublisherFilter;

        return matchSearch && matchPublisher;
      })
      .sort((a, b) => {
        let valA = a[sortBy];
        let valB = b[sortBy];

        if (typeof valA === "string") valA = (valA as string).toLowerCase();
        if (typeof valB === "string") valB = (valB as string).toLowerCase();

        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
  }, [searchTerm, selectedPublisherFilter, sortBy, sortOrder]);

  const handleSort = (field: "rank" | "price" | "discount") => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  // Chat message sending to full-stack Gemini RAG API
  const handleSendMessage = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const query = customQuery || chatInput;
    if (!query.trim()) return;

    const userMsg = { role: "user" as const, text: query };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userQuery: query,
          messages: chatMessages // Can serve for history in advanced iterations
        })
      });

      const data = await response.json();

      if (data.success) {
        setChatMessages(prev => [
          ...prev,
          { role: "assistant" as const, text: data.message }
        ]);
        if (data.retrievedBooks) {
          setChatbotRetrievedBooks(data.retrievedBooks);
        }
      } else {
        setChatMessages(prev => [
          ...prev,
          { role: "assistant" as const, text: `죄송합니다. 오류가 발생했습니다: ${data.error}` }
        ]);
      }
    } catch (err: any) {
      console.error(err);
      setChatMessages(prev => [
        ...prev,
        { role: "assistant" as const, text: `서버 연결에 실패했습니다. 책 정보 대시보드를 참고하시거나 잠시 후 다시 시도해 주세요.` }
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Recharts colors
  const COLORS = ["#4F46E5", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

  return (
    <div id="app-root" className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Upper Navigation Header */}
      <header id="header-nav" className="bg-white border-b border-slate-200 sticky top-0 z-50 px-4 md:px-8 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-indigo-100 shadow-lg">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                도서 종합 분석 대시보드 <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-100">베스트셀러 RAG 시스템</span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">인공지능(AI), 바이브 코딩, 교육 에듀테크 관련 인기 도서 150권 데이터 분석 및 Gemini 추천봇</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl self-start md:self-auto">
            <button
              id="tab-dashboard"
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "dashboard"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <PieChart className="w-4 h-4" />
              대시보드 분석
            </button>
            <button
              id="tab-chatbot"
              onClick={() => setActiveTab("chatbot")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "chatbot"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <MessageSquare className="w-4 h-4 animate-pulse" />
              AI 도서추천 챗봇
            </button>
            <button
              id="tab-explorer"
              onClick={() => setActiveTab("explorer")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "explorer"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <BookMarked className="w-4 h-4" />
              도서 전체 목록
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
        
        {/* TAB 1: DASHBOARD */}
        {activeTab === "dashboard" && (
          <div id="dashboard-section" className="space-y-8 animate-fade-in">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs text-slate-500 font-semibold block uppercase">분석 도서 총수</span>
                  <span className="text-3xl font-extrabold text-slate-900">{stats.totalCount}권</span>
                  <span className="text-xs text-indigo-600 font-medium block">최신 AI/IT 트렌드 도서</span>
                </div>
                <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl">
                  <BookOpen className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs text-slate-500 font-semibold block uppercase">평균 도서 판매가</span>
                  <span className="text-3xl font-extrabold text-slate-900">{stats.avgPrice.toLocaleString()}원</span>
                  <span className="text-xs text-emerald-600 font-medium block">대부분 10% 추가 혜택 적용</span>
                </div>
                <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs text-slate-500 font-semibold block uppercase">최고가 명품 도서</span>
                  <span className="text-xl font-bold text-slate-900 line-clamp-1">{stats.mostExpensive.title}</span>
                  <span className="text-sm font-semibold text-slate-600 block">{stats.mostExpensive.price.toLocaleString()}원</span>
                </div>
                <div className="bg-amber-50 text-amber-600 p-3 rounded-xl">
                  <Award className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs text-slate-500 font-semibold block uppercase">최고 할인 혜택</span>
                  <span className="text-3xl font-extrabold text-slate-900">10% 할인</span>
                  <span className="text-xs text-indigo-600 font-medium block">정가 대비 합리적인 가격 구성</span>
                </div>
                <div className="bg-violet-50 text-violet-600 p-3 rounded-xl">
                  <Tag className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Quick Navigation to Chatbot Banner */}
            <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 md:p-8 text-white flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-md relative overflow-hidden">
              <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl"></div>
              <div className="space-y-2 relative z-10">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/20 text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  RAG (검색 증강 생성) 기반 챗봇 탑재
                </div>
                <h3 className="text-xl md:text-2xl font-bold tracking-tight">원하는 테마의 책을 AI 챗봇에게 즉시 추천받으세요!</h3>
                <p className="text-sm text-indigo-200 max-w-2xl">
                  단순 검색을 넘어, 제미나이 3.5 모델이 150권의 정교한 책 순위, 저자, 가격, 상세 예스24 링크까지 종합 분석하여 여러분에게 최고의 맞춤 도서를 점찍어 드립니다.
                </p>
              </div>
              <button
                onClick={() => setActiveTab("chatbot")}
                className="bg-white text-indigo-900 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-all flex items-center gap-2 shadow-lg shadow-indigo-950/20 whitespace-nowrap self-start md:self-auto relative z-10"
              >
                추천 챗봇과 대화하기
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Visual Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Chart 1: Publisher share */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-indigo-600" />
                    주요 출판사 점유율 분석
                  </h3>
                  <span className="text-xs text-slate-400">도서 보유 수 기준</span>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={stats.topPublishers}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="count"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {stats.topPublishers.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value) => [`${value}권`, '보유량']} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs text-slate-500">
                  {stats.topPublishers.map((pub, idx) => (
                    <div key={idx} className="flex items-center justify-center gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                      <span className="font-medium truncate max-w-[80px]">{pub.name}</span>
                      <span className="font-bold text-slate-700">{pub.count}권</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart 2: Theme Keywords Distribution */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                    핵심 테마 및 키워드 빈도 분석
                  </h3>
                  <span className="text-xs text-slate-400">제목 내 출현 수 (중복 가능)</span>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.themeCounts} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 10 }}>
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
                      <RechartsTooltip formatter={(value) => [`${value}권`, '도서 수']} />
                      <Bar dataKey="count" fill="#4F46E5" radius={[0, 4, 4, 0]}>
                        {stats.themeCounts.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-slate-400 text-center">
                  * 클로드, 제미나이 등 특정 인공지능(AI) 플랫폼과 바이브 코딩, 교육용 에듀테크 관련 도서 비중이 매우 높습니다.
                </p>
              </div>

              {/* Chart 3: Price Bracket Histogram */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-indigo-600" />
                    도서 판매가격대 분포 (히스토그램)
                  </h3>
                  <span className="text-xs text-slate-400">구간별 도서 비율</span>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.priceBrackets} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                      <XAxis dataKey="range" />
                      <YAxis />
                      <RechartsTooltip formatter={(value) => [`${value}권`, '도서 수']} />
                      <Area type="monotone" dataKey="count" stroke="#4F46E5" fill="rgba(79, 70, 229, 0.15)" strokeWidth={3.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-slate-500 text-center">
                  주요 IT 전문 실무 도서들은 **20,000원 ~ 25,000원** 구간에 집중되어 가장 많은 분포를 형성하고 있습니다.
                </p>
              </div>

              {/* Chart 4: Discount breakdown */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-indigo-600" />
                    도서 할인율 통계
                  </h3>
                  <span className="text-xs text-slate-400">판매 가격 정책 구성</span>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.discountData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" />
                      <YAxis />
                      <RechartsTooltip formatter={(value) => [`${value}권`, '해당 도서 수']} />
                      <Bar dataKey="count" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-slate-500 text-center">
                  도서의 약 **95% 이상**이 소비자 혜택을 위해 기본 **10% 할인가**를 채택해 온/오프라인 경쟁력을 확보하고 있습니다.
                </p>
              </div>
            </div>

            {/* Quick Recommendations Insights */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Lightbulb className="w-4.5 h-4.5 text-amber-500" />
                트렌드 요약 리포트 (Insight)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <span className="bg-indigo-100 text-indigo-700 w-5 h-5 rounded-full inline-flex items-center justify-content-center text-xs font-bold">1</span>
                    인공지능 대세: 클로드 & 제미나이
                  </div>
                  <p className="text-xs leading-relaxed">
                    최근 2025~2026년 출간 도서 중 **'클로드(Claude) 코드'** 및 **'제미나이(Gemini)'** 관련 인공지능 실무서가 압도적 1위를 달리고 있습니다. 프롬프트 엔지니어링 및 개발 자동화 트렌드가 강력하게 자리잡고 있습니다.
                  </p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <span className="bg-indigo-100 text-indigo-700 w-5 h-5 rounded-full inline-flex items-center justify-content-center text-xs font-bold">2</span>
                    바이브 코딩(Vibe Coding)의 도래
                  </div>
                  <p className="text-xs leading-relaxed">
                    개발을 깊게 배우지 않아도 AI 도구를 활용해 1인 서비스를 개발하고 창업하는 **'바이브 코딩'** 서적군이 단시간에 베스트셀러 상위권(한빛미디어, 골든래빗 등 주도)에 대거 포진했습니다.
                  </p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <span className="bg-indigo-100 text-indigo-700 w-5 h-5 rounded-full inline-flex items-center justify-content-center text-xs font-bold">3</span>
                    교직 현장과 교육용 에듀테크
                  </div>
                  <p className="text-xs leading-relaxed">
                    2022 개정 교육과정 도입에 맞추어 현직 교사들과 학부모들을 위한 **'AI 클래스룸, 캔바, 패들렛, 노트북LM'** 등 맞춤 업무 경감 및 수업 혁신을 돕는 에듀테크 전문 도서의 성장세가 무섭습니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AI CHATBOT (RAG) */}
        {activeTab === "chatbot" && (
          <div id="chatbot-section" className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
            {/* Left Column: Chat Area (7 cols) */}
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-[650px] overflow-hidden">
              
              {/* Chat Header */}
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      Gemini-3.5-flash <span className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded font-normal">RAG 기반 추천</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">책 상세정보, 판매가, 직접 구매 링크(예스24) 완벽 연동</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setChatMessages([
                      {
                        role: "assistant",
                        text: "대화방을 초기화했습니다. 무엇이든 편하게 물어보세요! 😊"
                      }
                    ]);
                    setChatbotRetrievedBooks([]);
                  }}
                  className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1 border border-slate-200 hover:border-indigo-100 px-2.5 py-1.5 rounded-lg bg-white transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  대화 리셋
                </button>
              </div>

              {/* Chat Message Lists */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
                {chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex gap-3 max-w-[85%] ${
                      msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                    }`}
                  >
                    {msg.role !== "user" && (
                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md flex-shrink-0 text-sm font-bold">
                        AI
                      </div>
                    )}
                    <div className="space-y-1">
                      <div
                        className={`p-4 rounded-2xl shadow-sm border ${
                          msg.role === "user"
                            ? "bg-indigo-600 text-white border-indigo-700 rounded-tr-none"
                            : "bg-white text-slate-800 border-slate-200/80 rounded-tl-none"
                        }`}
                      >
                        {msg.role === "user" ? (
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                        ) : (
                          <MarkdownRenderer text={msg.text} />
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block px-1 text-right">
                        {msg.role === "user" ? "나" : "도서AI 비서"}
                      </span>
                    </div>
                  </div>
                ))}

                {isChatLoading && (
                  <div className="flex gap-3 mr-auto max-w-[80%]">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md flex-shrink-0 text-sm font-bold animate-spin">
                      ⏳
                    </div>
                    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm rounded-tl-none space-y-2">
                      <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-bounce" />
                        도서 데이터베이스 검색 및 맞춤형 답변 생성 중...
                      </p>
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-indigo-300 animate-bounce delay-75"></span>
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce delay-150"></span>
                        <span className="w-2 h-2 rounded-full bg-indigo-300 animate-bounce delay-300"></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Predefined Quick Questions tags */}
              <div className="px-6 py-2 border-t border-slate-100 flex flex-wrap gap-1.5 bg-slate-50 max-h-24 overflow-y-auto">
                <span className="text-xs text-slate-400 self-center mr-1">빠른 질문:</span>
                {[
                  "초보자를 위한 파이썬 책",
                  "클로드 코드를 사용한 인공지능 코딩 책",
                  "교사 및 에듀테크 관련 추천",
                  "유튜브 쇼츠 영상 편집 도서",
                  "엑셀 실무 및 자동화 추천",
                  "인공지능 윤리 및 미래 지식"
                ].map((tag, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(undefined, `${tag} 관련해서 순위 높은 우수 도서들을 링크와 가격과 함께 골라줘.`)}
                    disabled={isChatLoading}
                    className="text-[11px] bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 px-2.5 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {/* Chat Input form */}
              <form onSubmit={handleSendMessage} className="border-t border-slate-200 px-6 py-4 flex gap-2 bg-white">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isChatLoading}
                  placeholder="예: 클로드 코드 마스터나 파이썬 기초에 대한 책을 가격이랑 같이 알려줘"
                  className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 disabled:bg-slate-50 transition-all"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isChatLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl font-medium text-sm flex items-center gap-1.5 transition-all shadow-md shadow-indigo-100 disabled:opacity-50 disabled:shadow-none cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  전송
                </button>
              </form>
            </div>

            {/* Right Column: RAG Retrieved Reference Cards (4 cols) */}
            <div className="lg:col-span-4 flex flex-col h-[650px] space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col h-full overflow-hidden">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <BookMarked className="w-4 h-4 text-indigo-600" />
                    실시간 매칭 참고 도서 ({chatbotRetrievedBooks.length})
                  </h4>
                  <span className="text-[10px] text-slate-400">RAG 검색 결과</span>
                </div>

                {chatbotRetrievedBooks.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-3">
                    <div className="bg-slate-50 p-4 rounded-full">
                      <Search className="w-8 h-8 text-slate-300" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-600">매칭된 도서가 없습니다</p>
                      <p className="text-[11px] leading-relaxed">
                        왼쪽 채팅방에서 찾으시는 기술 키워드나 책 이름을 입력하여 질문하면, 실시간으로 가장 매칭률이 높은 도서 메타데이터가 이곳에 동기화됩니다.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto pt-4 space-y-3 pr-1">
                    <p className="text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-2 rounded-xl flex items-center gap-1">
                      <Info className="w-3.5 h-3.5 flex-shrink-0" />
                      이 도서 목록을 바탕으로 AI가 대답했습니다.
                    </p>
                    
                    {chatbotRetrievedBooks.map((book) => (
                      <div
                        key={book.rank}
                        className="bg-slate-50 hover:bg-indigo-50/40 p-3 rounded-xl border border-slate-100 hover:border-indigo-100 transition-all flex gap-3 group relative overflow-hidden"
                      >
                        {/* Book Image */}
                        <div className="w-14 h-20 bg-white border border-slate-200 rounded overflow-hidden flex-shrink-0 flex items-center justify-center shadow-xs">
                          {book.image ? (
                            <img
                              src={book.image}
                              alt={book.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-all"
                            />
                          ) : (
                            <BookOpen className="w-6 h-6 text-slate-300" />
                          )}
                        </div>

                        {/* Book Details */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                              {book.rank}위
                            </span>
                            <h5 className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors">
                              {book.title}
                            </h5>
                            <p className="text-[10px] text-slate-400 truncate">
                              {book.author} | {book.publisher}
                            </p>
                          </div>
                          
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs font-bold text-slate-700">
                              {book.price.toLocaleString()}원
                              <span className="text-[9px] text-emerald-600 ml-1 font-normal">
                                ({book.discount}% Off)
                              </span>
                            </span>
                            
                            <a
                              href={book.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] bg-white border border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-700 px-2 py-1 rounded flex items-center gap-1 shadow-2xs transition-all"
                            >
                              구매링크
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: EXPLORER TABLE */}
        {activeTab === "explorer" && (
          <div id="explorer-section" className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6 animate-fade-in">
            {/* Table Header Filter controls */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-b border-slate-100 pb-6">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                  <BookMarked className="w-5 h-5 text-indigo-600" />
                  전체 도서 데이터 아카이브
                </h3>
                <p className="text-xs text-slate-500">순위, 저자, 출판사, 가격, 할인 정책 다중 필터링 및 탐색</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                {/* Search Bar */}
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="제목, 저자, 출판사 검색..."
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 transition-all bg-slate-50/50"
                  />
                </div>

                {/* Publisher Select filter */}
                <select
                  value={selectedPublisherFilter}
                  onChange={(e) => setSelectedPublisherFilter(e.target.value)}
                  className="px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 transition-all bg-slate-50/50 text-slate-600"
                >
                  <option value="all">모든 출판사</option>
                  {stats.publisherList.map((pub, idx) => (
                    <option key={idx} value={pub}>{pub}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Book Table Responsive Wrapper */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase bg-slate-50/50">
                    <th
                      onClick={() => handleSort("rank")}
                      className="py-4 px-4 cursor-pointer hover:text-indigo-600 hover:bg-slate-100/50 transition-colors rounded-l-lg"
                    >
                      <div className="flex items-center gap-1">
                        순위
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="py-4 px-4">표지 및 제목</th>
                    <th className="py-4 px-4">저자 / 출판사</th>
                    <th className="py-4 px-4">출간일</th>
                    <th
                      onClick={() => handleSort("price")}
                      className="py-4 px-4 cursor-pointer hover:text-indigo-600 hover:bg-slate-100/50 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        판매가
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("discount")}
                      className="py-4 px-4 cursor-pointer hover:text-indigo-600 hover:bg-slate-100/50 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        할인율
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="py-4 px-4 text-center rounded-r-lg">링크</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredBooks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <p className="font-semibold text-sm">일치하는 검색 조건의 책이 없습니다</p>
                        <p className="text-xs mt-1">검색어를 수정하시거나 다른 출판사를 필터링해 보세요.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredBooks.map((book) => (
                      <tr key={book.rank} className="hover:bg-slate-50/60 transition-colors text-xs md:text-sm group">
                        <td className="py-4 px-4 font-bold text-slate-900">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100/50">
                            {book.rank}
                          </span>
                        </td>
                        <td className="py-4 px-4 max-w-sm">
                          <div className="flex gap-3">
                            <div className="w-10 h-14 bg-slate-100 border border-slate-200 rounded overflow-hidden flex-shrink-0 flex items-center justify-center shadow-2xs">
                              {book.image ? (
                                <img
                                  src={book.image}
                                  alt={book.title}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-all"
                                />
                              ) : (
                                <BookOpen className="w-5 h-5 text-slate-300" />
                              )}
                            </div>
                            <div className="space-y-0.5 self-center">
                              <span className="font-bold text-slate-800 block line-clamp-2 leading-snug group-hover:text-indigo-600 transition-colors">
                                {book.title}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="space-y-0.5">
                            <span className="text-slate-800 font-medium block">{book.author}</span>
                            <span className="text-xs text-slate-400 block">{book.publisher}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-slate-500 whitespace-nowrap">{book.date}</td>
                        <td className="py-4 px-4 font-bold text-slate-800">
                          {book.price.toLocaleString()}원
                          <span className="text-[10px] text-slate-400 block font-normal line-through">
                            {book.originalPrice.toLocaleString()}원
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold ${
                            book.discount > 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-slate-100 text-slate-500"
                          }`}>
                            {book.discount}% 할인
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <a
                            href={book.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-bold text-xs bg-indigo-50/50 hover:bg-indigo-100 border border-indigo-100 hover:border-indigo-300 px-3 py-2 rounded-xl transition-all shadow-2xs"
                          >
                            Yes24 보러가기
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination / Count summary */}
            <div className="flex items-center justify-between text-xs text-slate-400 pt-4 border-t border-slate-100">
              <p>필터링된 결과: <strong>{filteredBooks.length}</strong>개 도서 (전체 {booksData.length}개 중)</p>
              <p>* 순위, 판매가, 할인율 열의 화살표 아이콘을 누르면 정렬할 수 있습니다.</p>
            </div>
          </div>
        )}
      </main>

      {/* Footer copyright */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-8 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p>© 2026 Book Dashboard & RAG Chatbot. Powered by Google AI Studio (Gemini-3.5-flash) & React Fullstack.</p>
          <p>이 대시보드와 추천 챗봇에 활용된 모든 도서 정보 및 가격, 순위 데이터는 YES24 실제 베스트셀러 및 최신 정보 데이터를 기초로 설계되었습니다.</p>
        </div>
      </footer>
    </div>
  );
}
