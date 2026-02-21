/**
 * AI Service 抽象層
 * 
 * 統一處理 Gemini 和 OpenAI API
 * 可輕鬆切換不同的 AI 服務
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export type AIProvider = 'gemini' | 'openai';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/**
 * AI Service Class
 */
export class AIService {
  private provider: AIProvider;
  private gemini?: GoogleGenerativeAI;
  private openai?: OpenAI;
  private model: string;

  constructor(config?: Partial<AIConfig>) {
    // 預設使用 Gemini（如果有設定）
    const geminiKey = config?.apiKey || process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (geminiKey) {
      this.provider = 'gemini';
      this.gemini = new GoogleGenerativeAI(geminiKey);
      // 新用戶請用 gemini-2.5-flash（2.0-flash 已不開放）；若 404 可改 .env 的 GEMINI_MODEL
      this.model = config?.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    } else if (openaiKey) {
      this.provider = 'openai';
      this.openai = new OpenAI({ apiKey: openaiKey });
      this.model = config?.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    } else {
      throw new Error('No AI API key found. Please set GEMINI_API_KEY or OPENAI_API_KEY');
    }
  }

  /**
   * 生成文字回應
   */
  async generateText(prompt: string, options?: {
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<AIResponse> {
    if (this.provider === 'gemini' && this.gemini) {
      return this.geminiGenerateText(prompt, options);
    } else if (this.provider === 'openai' && this.openai) {
      return this.openaiGenerateText(prompt, options);
    }
    
    throw new Error('AI service not initialized');
  }

  /**
   * 生成 JSON 回應
   */
  async generateJSON<T = any>(prompt: string, options?: {
    systemPrompt?: string;
    temperature?: number;
  }): Promise<T> {
    const response = await this.generateText(prompt, options);
    
    // 嘗試從回應中提取 JSON
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }
    
    return JSON.parse(jsonMatch[0]) as T;
  }

  /**
   * Gemini 實作
   */
  private async geminiGenerateText(prompt: string, options?: {
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<AIResponse> {
    const model = this.gemini!.getGenerativeModel({ 
      model: this.model,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 2000,
      }
    });

    // Gemini 的 system instruction 整合在 prompt 中
    const fullPrompt = options?.systemPrompt 
      ? `${options.systemPrompt}\n\n${prompt}`
      : prompt;

    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();

    return {
      content: text,
      usage: {
        // Gemini 也有 token 計數，但格式不同
        totalTokens: (response as any).usageMetadata?.totalTokenCount,
      }
    };
  }

  /**
   * OpenAI 實作
   */
  private async openaiGenerateText(prompt: string, options?: {
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<AIResponse> {
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
    
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });

    const response = await this.openai!.chat.completions.create({
      model: this.model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2000,
    });

    const content = response.choices[0]?.message?.content || '';

    return {
      content,
      usage: {
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens,
      }
    };
  }

  /**
   * 取得當前使用的 AI provider
   */
  getProvider(): AIProvider {
    return this.provider;
  }

  /**
   * 取得當前使用的模型
   */
  getModel(): string {
    return this.model;
  }
}

// 建立單例實例
let aiServiceInstance: AIService | null = null;

export function getAIService(): AIService {
  if (!aiServiceInstance) {
    aiServiceInstance = new AIService();
  }
  return aiServiceInstance;
}

/** DM 回覆情感分類結果 */
export type ResponseSentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'NEEDS_REVIEW';

export interface ClassifyResponseResult {
  sentiment: ResponseSentiment;
  isPositive: boolean;
}

/**
 * 對客戶回覆內容做情感/意圖分類（用於 inbox 回應）
 */
export async function classifyResponseSentiment(messageContent: string): Promise<ClassifyResponseResult> {
  const ai = getAIService();
  const prompt = `以下是一則 Instagram DM 中客戶回覆我們的訊息內容，請判斷情感與是否有興趣。

訊息內容：
"""
${messageContent.slice(0, 1000)}
"""

請回傳 JSON（只回傳 JSON，不要其他文字）：
{
  "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "NEEDS_REVIEW",
  "isPositive": boolean
}

說明：sentiment 為 POSITIVE=正面/有興趣，NEUTRAL=中立，NEGATIVE=明確拒絕或負面，NEEDS_REVIEW=無法判斷或需人工看。isPositive 為是否判斷為「有興趣/可跟進」的潛在客戶。`;

  try {
    const result = await ai.generateJSON<ClassifyResponseResult>(prompt, {
      systemPrompt: 'You are a B2B sales assistant. Respond with valid JSON only.',
      temperature: 0.3,
    });
    return {
      sentiment: result.sentiment ?? 'NEEDS_REVIEW',
      isPositive: Boolean(result.isPositive),
    };
  } catch {
    return { sentiment: 'NEEDS_REVIEW', isPositive: false };
  }
}

export default AIService;
