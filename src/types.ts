/**
 * Hair Lead Finder (Browser Version) - Type Definitions
 *
 * Uses OpenClaw browser automation to find leads directly on Instagram
 * without external scraping services.
 */

/** Configuration for the browser-based lead finder */
export interface BrowserLeadFinderConfig {
  /** Hashtags to search (without #) */
  hashtags: string[];

  /** Maximum number of profiles to analyze */
  maxProfiles: number;

  /** Minimum follower count to consider */
  minFollowers: number;

  /** Maximum follower count to consider */
  maxFollowers: number;

  /** Delay between actions (ms) to appear human-like */
  actionDelayMs: number;

  /** Your company/service name */
  companyName: string;

  /** Your service description for personalizing DMs */
  serviceDescription: string;

  /** OpenAI API key (or compatible) */
  llmApiKey: string;

  /** LLM model to use */
  llmModel: string;

  /** LLM base URL (optional, for OpenAI-compatible APIs) */
  llmBaseUrl?: string;
}

/** Profile data extracted from Instagram page */
export interface ExtractedProfile {
  /** Username */
  username: string;

  /** Display name */
  fullName: string;

  /** Bio text */
  biography: string;

  /** Follower count (parsed from text) */
  followersCount: number;

  /** Following count */
  followsCount: number;

  /** Posts count */
  postsCount: number;

  /** Whether it's a business/professional account */
  isBusinessAccount: boolean;

  /** Business category if available */
  businessCategory?: string;

  /** External link in bio */
  externalUrl?: string;

  /** Profile URL */
  profileUrl: string;

  /** Recent post captions (first few) */
  recentPostCaptions: string[];

  /** Raw snapshot text for additional context */
  rawSnapshot: string;
}

/** LLM analysis result */
export interface ProfileAnalysis {
  /** Is this likely a salon owner/manager? */
  isLikelyOwner: boolean;

  /** Confidence level */
  confidence: "high" | "medium" | "low";

  /** Recommendation score 0-10 */
  score: number;

  /** Reasons for the score */
  reasons: string[];

  /** Detected contact methods */
  contactMethods: {
    email?: string;
    phone?: string;
    line?: string;
    website?: string;
  };

  /** Generated DM options */
  dmOptions: Array<{
    style: "professional" | "friendly" | "value-focused";
    content: string;
  }>;

  /** Should we skip this profile? */
  shouldSkip: boolean;

  /** Skip reason if applicable */
  skipReason?: string;
}

/** A discovered lead */
export interface DiscoveredLead {
  /** Unique ID */
  id: string;

  /** Extracted profile data */
  profile: ExtractedProfile;

  /** LLM analysis */
  analysis: ProfileAnalysis;

  /** When discovered */
  discoveredAt: string;

  /** Source hashtag */
  sourceHashtag: string;
}

/** Crawler state for UI updates */
export interface CrawlerState {
  /** Current status */
  status:
    | "idle"
    | "starting"
    | "searching"
    | "browsing"
    | "analyzing"
    | "waiting"
    | "completed"
    | "error";

  /** Current hashtag being searched */
  currentHashtag?: string;

  /** Current profile being analyzed */
  currentProfile?: string;

  /** Total profiles found */
  profilesFound: number;

  /** Profiles analyzed so far */
  profilesAnalyzed: number;

  /** Leads discovered */
  leadsDiscovered: number;

  /** Profiles skipped */
  profilesSkipped: number;

  /** Status message */
  message: string;

  /** Error if any */
  error?: string;
}

/** Events emitted by the crawler */
export interface CrawlerEvents {
  onStateChange: (state: CrawlerState) => void;
  onLeadDiscovered: (lead: DiscoveredLead) => void;
  onProfileSkipped: (username: string, reason: string) => void;
  onError: (error: Error) => void;
}
