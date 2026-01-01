// Ask Threader AI Chat Service
// Handles LLM calls for the Ask Threader chat panel

import type { FocusArea, SynthesisReportV2 } from '@/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface AskThreaderRequest {
  question: string;
  selectedFeedback: FocusArea | null;
  synthesis: SynthesisReportV2;
  companyName: string;
}

export interface AskThreaderResponse {
  answer: string;
  error?: string;
}

/**
 * Calls the Ask Threader AI to get a response to a user question
 * Uses the Supabase Edge Function to securely call OpenAI
 */
export async function askThreader(request: AskThreaderRequest): Promise<AskThreaderResponse> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ask-threader`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed with status ${response.status}`);
    }

    const data = await response.json();
    return { answer: data.answer };
  } catch (error) {
    console.error('Ask Threader error:', error);

    // Fallback to local generation if edge function fails
    // This provides a graceful degradation for development/demo
    return {
      answer: generateLocalResponse(request),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fallback local response generator
 * Used when the edge function is unavailable (e.g., during development)
 * Generates dynamic responses based on actual report data
 */
function generateLocalResponse(request: AskThreaderRequest): string {
  const { question, selectedFeedback, synthesis, companyName } = request;
  const lowerQuery = question.toLowerCase();

  // If there's selected feedback, tailor the response to it
  if (selectedFeedback) {
    return generateFeedbackResponse(selectedFeedback, synthesis, lowerQuery, companyName);
  }

  // General questions about the report
  return generateGeneralResponse(synthesis, lowerQuery, companyName);
}

function generateFeedbackResponse(
  feedback: FocusArea,
  synthesis: SynthesisReportV2,
  query: string,
  companyName: string
): string {
  const trendText = feedback.trend === 'up'
    ? `rising (+${feedback.trendDelta} from last period)`
    : feedback.trend === 'down'
    ? `declining (-${Math.abs(feedback.trendDelta)} from last period)`
    : feedback.trend === 'new'
    ? 'newly identified in this analysis'
    : 'stable over time';

  // Why is this trending/rising?
  if (query.includes('why') && (query.includes('trend') || query.includes('rising') || query.includes('up'))) {
    return `**"${feedback.title}"** is ${trendText} based on our analysis.

**Key signals indicating this trend:**
- **Volume:** ${feedback.frequency} mentions in the analyzed period
- **Impact Score:** ${feedback.impactScore.toFixed(1)}/10, categorized as ${feedback.severityLabel}
- **Affected Segments:** ${feedback.affectedSegments.join(', ')}

${feedback.trend === 'up' ? `The increase suggests this is becoming a more pressing concern for ${companyName} users. ` : ''}${feedback.stakes.type === 'risk' ? `**Risk warning:** ${feedback.stakes.message}` : feedback.stakes.message}

${feedback.rootCause ? `**Potential root cause:** ${feedback.rootCause}` : ''}`;
  }

  // What caused this issue?
  if (query.includes('cause') || query.includes('why') || query.includes('root')) {
    return `Based on the feedback analysis for **"${feedback.title}"**:

${feedback.rootCause ? `**Identified Root Cause:** ${feedback.rootCause}` : `**Analysis:** The underlying cause appears to be related to ${feedback.category.replace('_', ' ')} issues affecting ${feedback.affectedSegments.slice(0, 2).join(' and ')}.`}

**Supporting Evidence:**
- User quote: "${feedback.topQuote}"
- ${feedback.frequency} users have mentioned this issue
- Impact assessment: ${feedback.scoreRationale}

${feedback.stakes.type === 'risk' ? `**Business Risk:** ${feedback.stakes.message}` : ''}`;
  }

  // How should we prioritize this?
  if (query.includes('priorit') || query.includes('should we') || query.includes('important')) {
    const rankIndex = synthesis.focusAreas.findIndex(a => a.id === feedback.id);
    const rank = rankIndex >= 0 ? rankIndex + 1 : 'N/A';

    const priorityLevel = feedback.impactScore >= 8
      ? 'Critical Priority'
      : feedback.impactScore >= 6
      ? 'High Priority'
      : feedback.impactScore >= 4
      ? 'Medium Priority'
      : 'Lower Priority';

    return `**Prioritization Assessment for "${feedback.title}":**

**Current Rank:** #${rank} of ${synthesis.focusAreas.length} focus areas
**Priority Level:** ${priorityLevel} (Impact: ${feedback.impactScore.toFixed(1)}/10)

**Factors to Consider:**
- **Reach:** ${feedback.frequency} users affected
- **Severity:** ${feedback.severityLabel}
- **Trend:** ${trendText}
- **Segments at Risk:** ${feedback.affectedSegments.join(', ')}

**Stakes:** ${feedback.stakes.message}

${feedback.impactScore >= 7 ? `**Recommendation:** Given the high impact score and ${feedback.stakes.type === 'risk' ? 'associated risks' : 'potential upside'}, this should be addressed in the near term.` : `**Recommendation:** Monitor and address as resources allow, but prioritize items with higher impact scores first.`}`;
  }

  // Default response for selected feedback
  return `**Analysis of "${feedback.title}":**

This ${feedback.category.replace('_', ' ')} issue has an impact score of **${feedback.impactScore.toFixed(1)}/10** with ${feedback.frequency} mentions.

**Status:** ${trendText}
**Affected Users:** ${feedback.affectedSegments.join(', ')}

**Key Quote:** "${feedback.topQuote}"

**Stakes:** ${feedback.stakes.message}

${feedback.scoreRationale}`;
}

function generateGeneralResponse(
  synthesis: SynthesisReportV2,
  query: string,
  companyName: string
): string {
  // What do users love?
  if (query.includes('love') || query.includes('positive') || query.includes('strength') || query.includes('like')) {
    const loves = synthesis.brandStrengths.topLoves;
    return `**What ${companyName} Users Love:**

${loves.map((love, i) => `${i + 1}. **${love.feature}** (Shareability: ${love.shareability}/10)
   "${love.quote}"`).join('\n\n')}

**Brand Perception:** ${synthesis.brandStrengths.brandPersonality.join(', ')}
**Overall Brand Score:** ${synthesis.brandStrengths.overallScore}/10

${synthesis.sentiment.positive}% of analyzed feedback was positive, indicating ${synthesis.sentiment.mood.toLowerCase()} overall sentiment.`;
  }

  // Top issues/problems
  if (query.includes('issue') || query.includes('problem') || query.includes('concern') || query.includes('top')) {
    const topIssues = synthesis.focusAreas.slice(0, 3);
    return `**Top Focus Areas for ${companyName}:**

${topIssues.map((area, i) => {
  const trendIcon = area.trend === 'up' ? '↑' : area.trend === 'down' ? '↓' : area.trend === 'new' ? '★' : '—';
  return `${i + 1}. **${area.title}** ${trendIcon}
   - Impact: ${area.impactScore.toFixed(1)}/10 | ${area.frequency} mentions
   - ${area.stakes.message}`;
}).join('\n\n')}

**Overall Sentiment:** ${synthesis.sentiment.positive}% positive, ${synthesis.sentiment.neutral}% neutral, ${synthesis.sentiment.negative}% negative`;
  }

  // Comparison/trends
  if (query.includes('compar') || query.includes('previous') || query.includes('change')) {
    const rising = synthesis.focusAreas.filter(a => a.trend === 'up');
    const declining = synthesis.focusAreas.filter(a => a.trend === 'down');
    const newIssues = synthesis.focusAreas.filter(a => a.trend === 'new');

    return `**Trend Analysis for ${companyName}:**

${rising.length > 0 ? `**Rising Issues (${rising.length}):**\n${rising.map(a => `- ${a.title} (+${a.trendDelta})`).join('\n')}` : '**No rising issues detected.**'}

${declining.length > 0 ? `\n**Declining Issues (${declining.length}):**\n${declining.map(a => `- ${a.title} (-${Math.abs(a.trendDelta)})`).join('\n')}` : ''}

${newIssues.length > 0 ? `\n**Newly Identified (${newIssues.length}):**\n${newIssues.map(a => `- ${a.title}`).join('\n')}` : ''}

**Current Sentiment:** ${synthesis.sentiment.mood} — ${synthesis.sentiment.moodExplanation}`;
  }

  // Q1/priorities/what to do
  if (query.includes('priorit') || query.includes('q1') || query.includes('next') || query.includes('should')) {
    const okrs = synthesis.suggestedOKRs;
    return `**Recommended Priorities for ${companyName}:**

${okrs.slice(0, 2).map((okr, i) => `**${okr.timeframe} — ${okr.theme}**
Objective: ${okr.objective}

Key Results:
${okr.keyResults.map(kr => `• ${kr}`).join('\n')}`).join('\n\n')}

**Based on the data:** Focus on ${synthesis.focusAreas[0]?.title || 'top issues'} first (${synthesis.focusAreas[0]?.frequency || 0} mentions, ${synthesis.focusAreas[0]?.impactScore.toFixed(1) || 0}/10 impact).`;
  }

  // Default overview response
  return `**${companyName} Feedback Analysis Overview:**

**Volume:** ${synthesis.metadata.totalAnalyzed} items analyzed, ${synthesis.metadata.highSignalCount} high-signal
**Sentiment:** ${synthesis.sentiment.positive}% positive, ${synthesis.sentiment.negative}% negative (${synthesis.sentiment.mood})
**Focus Areas:** ${synthesis.focusAreas.length} identified

**Top 3 Focus Areas:**
${synthesis.focusAreas.slice(0, 3).map((a, i) => `${i + 1}. ${a.title} (${a.impactScore.toFixed(1)}/10)`).join('\n')}

**Brand Strength:** ${synthesis.brandStrengths.overallScore}/10 — users love ${synthesis.brandStrengths.topLoves[0]?.feature || 'the product'}

What specific aspect would you like to explore?`;
}
