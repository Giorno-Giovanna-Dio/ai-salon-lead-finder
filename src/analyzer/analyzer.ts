/**
 * Profile Analyzer - LLM-powered analysis using OpenAI API
 *
 * Analyzes Instagram profiles to identify salon owners
 * and generate personalized DM options.
 */

import OpenAI from "openai";
import type {
  BrowserLeadFinderConfig,
  ExtractedProfile,
  ProfileAnalysis,
} from "./types.js";

interface AnalyzerOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

const ANALYSIS_PROMPT = `你是一個專業的 B2B 銷售分析師，專門協助找出美容美髮產業的潛在客戶。

分析以下 Instagram 帳號，判斷這個帳號是否為美容美髮沙龍的店長或經營者（而非員工或網紅）。

## 帳號資訊
- 用戶名：{{username}}
- 顯示名稱：{{fullName}}
- Bio：{{biography}}
- 追蹤者：{{followersCount}}
- 貼文數：{{postsCount}}
- 是否商業帳號：{{isBusinessAccount}}
- 商業類別：{{businessCategory}}
- 外部連結：{{externalUrl}}
- 近期貼文摘要：{{recentPosts}}

## 我們的服務
{{serviceDescription}}

## 分析要求
請分析並回傳 JSON 格式（只回傳 JSON，不要其他文字）：

{
  "isLikelyOwner": boolean,
  "confidence": "high" | "medium" | "low",
  "score": number (0-10),
  "reasons": ["原因1", "原因2", ...],
  "contactMethods": {
    "email": "extracted email or null",
    "phone": "extracted phone or null",
    "line": "extracted line id or null",
    "website": "extracted website or null"
  },
  "dmOptions": [
    {
      "style": "professional",
      "content": "專業風格的完整 DM 內容（100-200字）"
    },
    {
      "style": "friendly",
      "content": "親切風格的完整 DM 內容（100-200字）"
    },
    {
      "style": "value-focused",
      "content": "價值導向的完整 DM 內容（100-200字）"
    }
  ],
  "shouldSkip": boolean,
  "skipReason": "如果 shouldSkip 為 true，說明原因"
}

判斷標準：
- 如果是員工帳號（非經營者）→ shouldSkip: true
- 如果是網紅/KOL（非實體店面）→ shouldSkip: true
- 如果是私人帳號或非美容美髮相關 → shouldSkip: true
- score >= 7 才值得聯繫
- DM 內容要個人化，引用帳號的特色`;

export class ProfileAnalyzer {
  private client: OpenAI;
  private model: string;

  constructor(options: AnalyzerOptions) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseUrl,
    });
    this.model = options.model;
  }

  /**
   * Analyze a profile and generate DM options
   */
  async analyzeProfile(
    profile: ExtractedProfile,
    config: BrowserLeadFinderConfig
  ): Promise<ProfileAnalysis> {
    const prompt = this.buildPrompt(profile, config);

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content:
              "You are a B2B sales analyst. Always respond with valid JSON only, no markdown or explanations.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content || "";

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("No JSON found in response:", content);
        return this.createFallbackAnalysis(profile);
      }

      const analysis = JSON.parse(jsonMatch[0]) as ProfileAnalysis;
      return analysis;
    } catch (error) {
      console.error("LLM analysis failed:", error);
      return this.createFallbackAnalysis(profile);
    }
  }

  /**
   * Build the analysis prompt
   */
  private buildPrompt(
    profile: ExtractedProfile,
    config: BrowserLeadFinderConfig
  ): string {
    const recentPosts =
      profile.recentPostCaptions.length > 0
        ? profile.recentPostCaptions.join("\n- ")
        : "(無法取得)";

    return ANALYSIS_PROMPT.replace("{{username}}", profile.username)
      .replace("{{fullName}}", profile.fullName)
      .replace("{{biography}}", profile.biography || "(無)")
      .replace("{{followersCount}}", profile.followersCount.toLocaleString())
      .replace("{{postsCount}}", profile.postsCount.toString())
      .replace("{{isBusinessAccount}}", profile.isBusinessAccount ? "是" : "否")
      .replace("{{businessCategory}}", profile.businessCategory || "未設定")
      .replace("{{externalUrl}}", profile.externalUrl || "無")
      .replace("{{recentPosts}}", recentPosts)
      .replace(
        "{{serviceDescription}}",
        `${config.companyName}: ${config.serviceDescription}`
      );
  }

  /**
   * Create a fallback analysis when LLM fails
   */
  private createFallbackAnalysis(profile: ExtractedProfile): ProfileAnalysis {
    const bio = profile.biography.toLowerCase();
    const isLikelyOwner =
      bio.includes("店長") ||
      bio.includes("創辦") ||
      bio.includes("owner") ||
      bio.includes("salon") ||
      bio.includes("美髮") ||
      bio.includes("hair");

    return {
      isLikelyOwner,
      confidence: "low",
      score: isLikelyOwner ? 5 : 2,
      reasons: ["需要人工審核 - LLM 分析失敗"],
      contactMethods: {},
      dmOptions: [],
      shouldSkip: !isLikelyOwner,
      skipReason: isLikelyOwner ? undefined : "無法確認是否為目標客戶",
    };
  }
}
