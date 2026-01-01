// Threader AI Dashboard Types v2.0

// ============================================================================
// IMPACT SCORING
// ============================================================================

export interface ImpactBreakdown {
  reach: { value: number; weight: number };
  sentiment: { value: number; weight: number };
  velocity: { value: number; weight: number };
}

export interface ImpactData {
  score: number;
  maxScore: number;
  breakdown: ImpactBreakdown;
  rationale: string;
  stakes: Stakes;
}

export interface Stakes {
  type: 'risk' | 'upside' | 'neutral';
  message: string;
}

// ============================================================================
// FOCUS AREAS (replaces Pain Points)
// ============================================================================

export type FocusAreaCategory = 'feature_request' | 'usability_friction' | 'bug' | 'praise';
export type TrendDirection = 'up' | 'down' | 'stable' | 'new';
export type SeverityLevel = 'Critical' | 'High' | 'Medium' | 'Low';

export interface FocusArea {
  id: string;
  title: string;
  category: FocusAreaCategory;
  impactScore: number;
  frequency: number;
  trend: TrendDirection;
  trendDelta: number;
  severityLabel: SeverityLevel;
  topQuote: string;
  rootCause?: string;
  stakes: Stakes;
  scoreRationale: string;
  affectedSegments: string[];
  sourceUrl?: string; // Reddit post URL
  subreddit?: string; // Subreddit name (e.g., "r/starbucks")
}

// ============================================================================
// BRAND STRENGTHS
// ============================================================================

export interface BrandLove {
  feature: string;
  quote: string;
  shareability: number;
}

export interface BrandStrengths {
  overallScore: number;
  topLoves: BrandLove[];
  brandPersonality: string[];
}

// ============================================================================
// OKRS
// ============================================================================

export interface SuggestedOKR {
  theme: string;
  objective: string;
  keyResults: string[];
  timeframe: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'H1' | 'H2';
}

// ============================================================================
// MULTI-RESOLUTION SUMMARIES
// ============================================================================

export interface Summaries {
  tldr: string;
  highlights: string[];
  executiveBrief: string;
}

// ============================================================================
// SENTIMENT
// ============================================================================

export type MoodLevel = 'Thriving' | 'Stable' | 'Concerning' | 'Critical';

export interface Sentiment {
  positive: number;
  neutral: number;
  negative: number;
  mood: MoodLevel;
  moodExplanation: string;
}

// ============================================================================
// PRIORITY MATRIX
// ============================================================================

export type EffortEstimate = 'Quick Win' | 'Medium' | 'Large';
export type PriorityQuadrant = 'Quick Wins' | 'Strategic Investments' | 'Fill-ins' | 'Reconsider';

export interface PriorityMatrixItem {
  title: string;
  category: FocusAreaCategory;
  impactScore: number;
  effortEstimate: EffortEstimate;
  quadrant: PriorityQuadrant;
  frequency: number;
}

// ============================================================================
// EXPECTATION GAPS
// ============================================================================

export interface ExpectationGap {
  expectation: string;
  reality: string;
  gapSeverity: 'High' | 'Medium' | 'Low';
  suggestedFix: string;
}

// ============================================================================
// METADATA & SNAPSHOTS
// ============================================================================

export interface AnalysisMetadata {
  totalAnalyzed: number;
  highSignalCount: number;
  noiseFiltered: number;
  dataSources: string[];
  analysisDate: string;
}

export interface Snapshot {
  id: string;
  companyName: string;
  createdAt: string;
  focusAreas: Array<{
    title: string;
    category: FocusAreaCategory;
    frequency: number;
    impactScore: number;
  }>;
  sentiment: Sentiment;
  metadata: AnalysisMetadata;
}

// ============================================================================
// DIFFERENTIAL ANALYSIS
// ============================================================================

export interface ChangeItem {
  title: string;
  category: FocusAreaCategory;
  changeType: 'new' | 'improved' | 'worsened' | 'resolved' | 'stable';
  frequencyDelta?: number;
  impactDelta?: number;
  insight: string;
}

export interface TrendData {
  sentiment: {
    current: Sentiment;
    previous: Sentiment;
    delta: number;
    direction: 'improving' | 'declining' | 'stable';
    moodChange: boolean;
  };
  volume: {
    current: number;
    previous: number;
    delta: number;
    direction: 'up' | 'down' | 'stable';
  };
  resolutionRate: number;
  newIssueRate: number;
  overallHealth: number;
}

export interface Comparison {
  isFirstRun: boolean;
  comparedAt?: string;
  previousSnapshotDate?: string;
  changes: {
    newIssues: ChangeItem[];
    improvedIssues: ChangeItem[];
    worsenedIssues: ChangeItem[];
    resolvedIssues: ChangeItem[];
    stableIssues: ChangeItem[];
  };
  trends: TrendData;
  summary: string;
}

// ============================================================================
// MAIN SYNTHESIS REPORT v2.0
// ============================================================================

export interface SynthesisReportV2 {
  summaries: Summaries;
  sentiment: Sentiment;
  focusAreas: FocusArea[];
  brandStrengths: BrandStrengths;
  suggestedOKRs: SuggestedOKR[];
  priorityMatrix: PriorityMatrixItem[];
  expectationGaps: ExpectationGap[];
  metadata: AnalysisMetadata;
  rawScores?: Array<{
    id: string;
    impactData: ImpactData;
  }>;
}

// ============================================================================
// FEEDBACK ITEMS (for Evidence Log)
// ============================================================================

export interface FeedbackItem {
  id: string;
  sourceId: string;
  source: 'reddit' | 'twitter' | 'other';
  subreddit?: string;
  title: string;
  content: string;
  author: string;
  url: string;
  score: number;
  numComments: number;
  createdAt: string;
  classification: Classification;
  impactData?: ImpactData;
}

export interface Classification {
  type: 'Constructive' | 'Praise' | 'Neutral';
  category: 'Feature Request' | 'Usability Friction' | 'Support Question' | 'Rant/Opinion' | 'Bug' | 'N/A';
  problemMetadata: ProblemMetadata | null;
  delightMetadata: DelightMetadata | null;
  summary: {
    actionableInsight: string;
    replyDraft: string;
    keyQuote: string;
  };
  confidence: number;
  reasoning: string;
}

export interface ProblemMetadata {
  rootCause: string;
  featureArea: string;
  impactType: 'Revenue' | 'Retention' | 'Acquisition' | 'Activation' | 'Referral';
  urgencySignal: 'Churn Risk' | 'Workaround Found' | 'Tolerated' | 'Feature Wish' | 'Competitor Mentioned';
  userSegmentGuess: string;
  impactScore: number;
  urgencyScore: number;
  effortGuess: 'Quick Win' | 'Medium' | 'Large';
}

export interface DelightMetadata {
  ahaMonent: string;
  valuePropValidation: string;
  shareability: number;
  testimonialQuote: string;
}

// ============================================================================
// MONITOR SETTINGS
// ============================================================================

export type UpdateFrequency = 'daily' | 'weekly' | 'monthly' | 'manual';

export interface MonitorSettings {
  companyName: string;
  autoUpdate: boolean;
  updateFrequency: UpdateFrequency;
  dataSources: string[];
  notifications: {
    email: boolean;
    slack: boolean;
    criticalOnly: boolean;
  };
  lastUpdated: string;
  nextScheduledUpdate?: string;
}

// ============================================================================
// VIEW MODE
// ============================================================================

export type ViewMode = 'tldr' | 'highlights' | 'deep_dive';

// ============================================================================
// CATEGORY COLORS (for UI)
// ============================================================================

export const CATEGORY_COLORS: Record<FocusAreaCategory, string> = {
  feature_request: '#3b82f6', // Blue
  usability_friction: '#f97316', // Orange
  bug: '#ef4444', // Red
  praise: '#22c55e', // Green
};

export const CATEGORY_LABELS: Record<FocusAreaCategory, string> = {
  feature_request: 'Feature Request',
  usability_friction: 'Usability',
  bug: 'Bug',
  praise: 'Praise',
};
