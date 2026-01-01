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
  const segments = feedback.affectedSegments.slice(0, 2).join(' and ');
  const isSmallVolume = feedback.frequency <= 5;

  // Why is this trending/rising?
  if (query.includes('why') && (query.includes('trend') || query.includes('rising') || query.includes('up'))) {
    return `One way to look at this: ${feedback.trend === 'up' ? "something shifted recently that's making this more visible — could be a policy change, a seasonal thing, or just frustration that's been building." : "it might be catching attention now because of timing or because it's hitting a specific group harder."}

${isSmallVolume ? "It's still early signal territory, so I wouldn't panic yet." : "The volume suggests this isn't just one-off noise."} The ${segments} seem most affected, which might tell you where to look first.

${feedback.rootCause ? `If I had to guess at root cause: ${feedback.rootCause.toLowerCase()}. But you'd want to validate that.` : "Worth asking: what changed recently? Or is this something that's always been there but people are finally speaking up about?"}`;
  }

  // What caused this issue?
  if (query.includes('cause') || query.includes('why') || query.includes('root')) {
    return `Hard to say for certain, but a few possibilities based on the feedback:

${feedback.rootCause ? `- **${feedback.rootCause}** seems like the most likely culprit based on the patterns.` : `- Could be a gap in how this is communicated or documented.
- Might be inconsistent enforcement or unclear expectations.
- Or it's been an issue for a while and is just now surfacing.`}

${feedback.stakes.type === 'risk' ? `If it's left ambiguous, you risk ${feedback.stakes.message.toLowerCase()}` : ''}

One low-effort step: talk to a couple of the affected ${segments} directly. The quotes give you the "what" — conversations will give you the "why."`;
  }

  // How should we prioritize this?
  if (query.includes('priorit') || query.includes('should we') || query.includes('important')) {
    const rankIndex = synthesis.focusAreas.findIndex(a => a.id === feedback.id);
    const rank = rankIndex >= 0 ? rankIndex + 1 : null;

    let perspective = '';
    if (feedback.impactScore >= 8) {
      perspective = "This one probably deserves attention sooner rather than later.";
    } else if (feedback.impactScore >= 6) {
      perspective = "It's not the most urgent thing, but I wouldn't let it sit for too long either.";
    } else if (isSmallVolume) {
      perspective = "Right now it's more of an early signal than a crisis. Worth monitoring, but probably not sprint-worthy yet.";
    } else {
      perspective = "You could batch this with similar improvements when you have cycles.";
    }

    return `${perspective}

${rank && rank <= 3 ? `It's ranking in your top 3 focus areas, so the data thinks it matters.` : ''} A few things to weigh:

- **Who it affects:** ${segments}
- **What's at stake:** ${feedback.stakes.message.toLowerCase()}
- **Trajectory:** ${feedback.trend === 'up' ? "It's trending up, which usually means it'll get louder if ignored." : feedback.trend === 'new' ? "It's new, so hard to say if it'll grow or fade." : "It's been stable, so you have some breathing room."}

If you want to be cautious, you could address it proactively before it escalates. If resources are tight, keep an eye on the trend and revisit next cycle.`;
  }

  // Default / open-ended questions
  return `A few angles to consider here:

${feedback.stakes.type === 'risk' ? `**If this continues unchecked:** ${feedback.stakes.message}` : `**The core tension:** ${feedback.stakes.message}`}

${isSmallVolume ? "Volume is low right now, so this is more early signal than widespread problem." : `With ${feedback.frequency} mentions, it's significant enough to take seriously.`} The ${segments} seem to feel it most.

You could:
- Dig into whether this is an isolated case or a pattern
- Clarify expectations or documentation if that's the gap
- Have a quick conversation with someone affected to understand context

What specifically are you trying to figure out?`;
}

function generateGeneralResponse(
  synthesis: SynthesisReportV2,
  query: string,
  companyName: string
): string {
  // What do users love?
  if (query.includes('love') || query.includes('positive') || query.includes('strength') || query.includes('like')) {
    const loves = synthesis.brandStrengths.topLoves;
    const topLove = loves[0];

    return `The strongest signal: people really respond to **${topLove?.feature || 'the core experience'}**. ${topLove ? `"${topLove.quote}"` : ''}

${loves.length > 1 ? `Also resonating: ${loves.slice(1).map(l => l.feature).join(', ')}.` : ''}

This is useful for a few things:
- **Retention messaging** — lean into what's already working
- **Onboarding** — make sure new users discover these strengths early
- **Competitive positioning** — if this is a differentiator, own it

Brand perception overall: ${synthesis.brandStrengths.brandPersonality.join(', ').toLowerCase()}. That's a solid foundation to build on.`;
  }

  // Top issues/problems
  if (query.includes('issue') || query.includes('problem') || query.includes('concern') || query.includes('top')) {
    const topIssue = synthesis.focusAreas[0];
    const risingIssues = synthesis.focusAreas.filter(a => a.trend === 'up');

    return `The loudest thing right now: **${topIssue?.title || 'top concern'}**. ${topIssue?.stakes.message || ''}

${risingIssues.length > 0 ? `Worth watching: ${risingIssues.map(a => a.title).join(', ')} ${risingIssues.length === 1 ? 'is' : 'are'} trending up.` : 'Nothing alarming on the rise at the moment.'}

A few ways to think about this:
- Is this a **quick fix** or a **systemic issue**?
- Is it affecting your most valuable users or a smaller segment?
- What happens if you ignore it for another quarter?

Want me to dig into any specific one?`;
  }

  // Comparison/trends
  if (query.includes('compar') || query.includes('previous') || query.includes('change')) {
    const rising = synthesis.focusAreas.filter(a => a.trend === 'up');
    const declining = synthesis.focusAreas.filter(a => a.trend === 'down');
    const newIssues = synthesis.focusAreas.filter(a => a.trend === 'new');

    let response = '';

    if (rising.length > 0) {
      response += `**Getting louder:** ${rising.map(a => a.title).join(', ')}. These might need attention before they escalate.\n\n`;
    }

    if (declining.length > 0) {
      response += `**Cooling off:** ${declining.map(a => a.title).join(', ')}. Either you fixed something, or it's fading naturally.\n\n`;
    }

    if (newIssues.length > 0) {
      response += `**New this period:** ${newIssues.map(a => a.title).join(', ')}. Too early to tell if these are blips or emerging patterns.\n\n`;
    }

    if (rising.length === 0 && declining.length === 0 && newIssues.length === 0) {
      response += `Things are relatively stable — no major shifts in either direction. That's either good news or a sign to dig deeper.\n\n`;
    }

    response += `Overall mood: ${synthesis.sentiment.mood.toLowerCase()}. ${synthesis.sentiment.moodExplanation}`;

    return response;
  }

  // Q1/priorities/what to do
  if (query.includes('priorit') || query.includes('q1') || query.includes('next') || query.includes('should')) {
    const topIssue = synthesis.focusAreas[0];
    const okrs = synthesis.suggestedOKRs;

    return `If I had to pick one thing to focus on: **${topIssue?.title || 'the top issue'}**. It's got the most momentum and clearest stakes.

Beyond that, depends on what you're optimizing for:

**Quick wins (address visible pain):**
${okrs[0]?.keyResults.slice(0, 2).map(kr => `- ${kr}`).join('\n') || '- Tackle the most frequent complaints first'}

**Longer-term health:**
- Dig into root causes before patching symptoms
- Talk to affected users to validate assumptions

The tradeoff: quick wins buy you goodwill, but might not fix underlying issues. Root cause work is slower but more durable. What's your bandwidth like?`;
  }

  // Default overview response
  const topIssue = synthesis.focusAreas[0];

  return `A few things stand out:

${topIssue ? `**Biggest signal:** ${topIssue.title} — ${topIssue.stakes.message.toLowerCase()}` : 'No single issue is dominating, which is either good news or means problems are fragmented.'}

${synthesis.brandStrengths.topLoves[0] ? `**Bright spot:** People genuinely like ${synthesis.brandStrengths.topLoves[0].feature.toLowerCase()}. That's worth protecting.` : ''}

Sentiment is ${synthesis.sentiment.mood.toLowerCase()} overall. ${synthesis.sentiment.moodExplanation}

What are you trying to figure out — where to focus, what's changing, or something specific?`;
}
