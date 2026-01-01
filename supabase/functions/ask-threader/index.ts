// Supabase Edge Function for Ask Threader AI Chat
// Handles LLM calls securely with OpenAI

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FocusArea {
  id: string;
  title: string;
  category: string;
  impactScore: number;
  frequency: number;
  trend: string;
  trendDelta: number;
  severityLabel: string;
  topQuote: string;
  rootCause?: string;
  stakes: { type: string; message: string };
  scoreRationale: string;
  affectedSegments: string[];
  sourceUrl?: string;
  subreddit?: string;
}

interface SynthesisReport {
  summaries: { tldr: string; highlights: string[]; executiveBrief: string };
  sentiment: { positive: number; neutral: number; negative: number; mood: string; moodExplanation: string };
  focusAreas: FocusArea[];
  brandStrengths: { overallScore: number; topLoves: { feature: string; quote: string; shareability: number }[]; brandPersonality: string[] };
  suggestedOKRs: { theme: string; objective: string; keyResults: string[]; timeframe: string }[];
  priorityMatrix: { title: string; category: string; impactScore: number; effortEstimate: string; quadrant: string; frequency: number }[];
  expectationGaps: { expectation: string; reality: string; gapSeverity: string; suggestedFix: string }[];
  metadata: { totalAnalyzed: number; highSignalCount: number; noiseFiltered: number; dataSources: string[]; analysisDate: string };
}

interface RequestBody {
  question: string;
  selectedFeedback: FocusArea | null;
  synthesis: SynthesisReport;
  companyName: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    const { question, selectedFeedback, synthesis, companyName }: RequestBody = await req.json();

    // Build the system prompt
    const systemPrompt = buildSystemPrompt(companyName);

    // Build the context from the report data
    const context = buildContext(selectedFeedback, synthesis, companyName);

    // Build the user message
    const userMessage = `${context}\n\nUser Question: ${question}`;

    // Call OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || "Unknown error"}`);
    }

    const data = await response.json();
    const answer = data.choices[0]?.message?.content || "I couldn't generate a response. Please try again.";

    return new Response(
      JSON.stringify({ answer }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in ask-threader function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

function buildSystemPrompt(companyName: string): string {
  return `You are Threader, an AI assistant that helps product and operations teams understand aggregated customer feedback from Reddit for ${companyName}.

Your role:
- Analyze customer complaints, feature requests, and sentiment patterns
- Provide actionable insights based on the data provided
- Help prioritize issues and identify root causes
- Be concise, specific, and data-driven

Guidelines:
- Use ONLY the provided report data and feedback when answering
- Reference specific numbers, quotes, and metrics from the data
- Avoid generic filler - every sentence should add value
- Keep answers to 2-5 short paragraphs or bullet points
- Be direct and helpful, not overly formal
- When discussing trends, mention specific frequency changes and patterns
- When prioritizing, consider impact score, affected segments, and business risk`;
}

function buildContext(selectedFeedback: FocusArea | null, synthesis: SynthesisReport, companyName: string): string {
  let context = `=== REPORT CONTEXT FOR ${companyName.toUpperCase()} ===\n\n`;

  // Summary stats
  context += `REPORT OVERVIEW:\n`;
  context += `- Total feedback analyzed: ${synthesis.metadata.totalAnalyzed}\n`;
  context += `- High-signal items: ${synthesis.metadata.highSignalCount}\n`;
  context += `- Data sources: ${synthesis.metadata.dataSources.join(", ")}\n`;
  context += `- Analysis date: ${synthesis.metadata.analysisDate}\n\n`;

  // Sentiment breakdown
  context += `SENTIMENT BREAKDOWN:\n`;
  context += `- Positive: ${synthesis.sentiment.positive}%\n`;
  context += `- Neutral: ${synthesis.sentiment.neutral}%\n`;
  context += `- Negative: ${synthesis.sentiment.negative}%\n`;
  context += `- Overall mood: ${synthesis.sentiment.mood} - ${synthesis.sentiment.moodExplanation}\n\n`;

  // If there's selected feedback, include it prominently
  if (selectedFeedback) {
    context += `=== SELECTED FEEDBACK (PRIMARY FOCUS) ===\n`;
    context += `Title: "${selectedFeedback.title}"\n`;
    context += `Category: ${selectedFeedback.category.replace("_", " ")}\n`;
    context += `Impact Score: ${selectedFeedback.impactScore.toFixed(1)}/10\n`;
    context += `Frequency: ${selectedFeedback.frequency} mentions\n`;
    context += `Trend: ${selectedFeedback.trend}${selectedFeedback.trendDelta !== 0 ? ` (${selectedFeedback.trendDelta > 0 ? "+" : ""}${selectedFeedback.trendDelta})` : ""}\n`;
    context += `Severity: ${selectedFeedback.severityLabel}\n`;
    if (selectedFeedback.subreddit) {
      context += `Subreddit: ${selectedFeedback.subreddit}\n`;
    }
    context += `Top Quote: "${selectedFeedback.topQuote}"\n`;
    if (selectedFeedback.rootCause) {
      context += `Root Cause: ${selectedFeedback.rootCause}\n`;
    }
    context += `Stakes: [${selectedFeedback.stakes.type}] ${selectedFeedback.stakes.message}\n`;
    context += `Score Rationale: ${selectedFeedback.scoreRationale}\n`;
    context += `Affected Segments: ${selectedFeedback.affectedSegments.join(", ")}\n\n`;
  }

  // All focus areas summary
  context += `ALL FOCUS AREAS (${synthesis.focusAreas.length} total):\n`;
  synthesis.focusAreas.forEach((area, i) => {
    const trendLabel = area.trend === "up" ? "↑ RISING" : area.trend === "down" ? "↓ DECLINING" : area.trend === "new" ? "★ NEW" : "— STABLE";
    context += `${i + 1}. ${area.title}\n`;
    context += `   - Category: ${area.category.replace("_", " ")} | Impact: ${area.impactScore.toFixed(1)} | ${area.frequency} mentions | ${trendLabel}\n`;
    context += `   - Stakes: ${area.stakes.message}\n`;
  });
  context += `\n`;

  // Brand strengths
  context += `BRAND STRENGTHS:\n`;
  context += `- Overall Score: ${synthesis.brandStrengths.overallScore}/10\n`;
  context += `- Brand Personality: ${synthesis.brandStrengths.brandPersonality.join(", ")}\n`;
  context += `- Top Loved Features:\n`;
  synthesis.brandStrengths.topLoves.forEach((love) => {
    context += `  • ${love.feature} (shareability: ${love.shareability}/10): "${love.quote.slice(0, 100)}..."\n`;
  });
  context += `\n`;

  // Expectation gaps
  if (synthesis.expectationGaps.length > 0) {
    context += `EXPECTATION GAPS:\n`;
    synthesis.expectationGaps.forEach((gap) => {
      context += `- [${gap.gapSeverity}] Expected: ${gap.expectation} | Reality: ${gap.reality}\n`;
    });
    context += `\n`;
  }

  // Suggested OKRs for context on priorities
  if (synthesis.suggestedOKRs.length > 0) {
    context += `SUGGESTED PRIORITIES:\n`;
    synthesis.suggestedOKRs.slice(0, 2).forEach((okr) => {
      context += `- ${okr.timeframe}: ${okr.objective}\n`;
    });
  }

  return context;
}
