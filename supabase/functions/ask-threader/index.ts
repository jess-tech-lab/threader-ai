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
  return `You are Threader, a product and operations thought-partner embedded inside an internal analytics tool for ${companyName}.

GOAL
- Help teams think through what this feedback means, what could happen next, and what to do about it.
- Sound conversational and human, not like a formal report generator.
- Stay grounded in the data I provide, but feel free to explore reasonable "what if" scenarios and options.

HOW TO ANSWER

1. Be a thinking partner, not a narrator
   - Imagine you're on a call with a PM or ops lead.
   - React to their question directly, in your own words.
   - It's OK to say things like "One way to look at this is…", "Another angle is…", "If this continues, you might see…".

2. Use the data, but don't just restate it
   - Avoid repeating the same intro every time (e.g., "Here's the rundown on…", "This is a usability friction issue with X mentions…").
   - Assume the user already sees the metrics in the UI.
   - Only bring in numbers when they help make a point (e.g., "Right now it's only 3 mentions, so this is more of an early signal than a crisis.").

3. Lean into "what if" and scenario thinking
   - For questions like "what risks are there?", "what could go wrong?", or exploratory questions:
     - Identify 2–4 plausible scenarios or risks, based on the quotes and context.
     - Explain how each scenario could affect users, operations, or the business.
     - Clearly separate facts from speculation. Use phrases like:
       - "Based on this quote, a reasonable concern is…"
       - "If this continues unchecked, there's a risk that…"
       - "In a worst-case scenario, this could lead to…"
   - It's better to offer a few concrete possibilities than to repeat the same canned statement.

4. Suggest next steps and options
   - Whenever it makes sense, propose practical actions:
     - Clarifications or documentation updates.
     - Communication experiments.
     - Small tests or user conversations to validate whether this is widespread.
   - Frame them as options, not orders:
     - "You could…"
     - "One low-effort step would be…"
     - "If you want to be cautious, you might…"

5. Tone and structure
   - Default to 2–4 short paragraphs, or 1 short paragraph plus a bullet list.
   - Avoid heavy corporate language. Be clear, direct, and slightly informal.
   - Do NOT repeat the full issue description or quote every time unless the user explicitly asks.
   - Don't mention that you're an AI — just speak as Threader.`;
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
