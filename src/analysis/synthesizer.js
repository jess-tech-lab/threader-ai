import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const llm = new ChatOpenAI({
  modelName: 'gpt-4o',
  temperature: 0.2,
});

// Impact = (Reach × 0.4) + (Sentiment × 0.3) + (Velocity × 0.3)
export function calculateImpactScore(item, totalItems = 100) {
  const upvotes = item.upvotes || item.score || 0;
  const comments = item.numComments || 0;
  const reach = Math.min(10, (upvotes + comments * 2) / 20);

  let sentiment = 5;
  if (item.type === 'Constructive') sentiment = item.problemMetadata?.impactScore || 7;
  else if (item.type === 'Praise') sentiment = item.delightMetadata?.shareability || 7;

  const createdAt = item.createdAt ? new Date(item.createdAt) : new Date();
  const ageInHours = Math.max(1, (Date.now() - createdAt.getTime()) / (1000 * 60 * 60));
  const velocity = Math.min(10, ((upvotes + comments) / ageInHours) * 2);

  const score = Math.round(((reach * 0.4) + (sentiment * 0.3) + (velocity * 0.3)) * 10) / 10;

  return {
    score,
    maxScore: 10,
    breakdown: {
      reach: { value: Math.round(reach * 10) / 10, weight: 0.4 },
      sentiment: { value: Math.round(sentiment * 10) / 10, weight: 0.3 },
      velocity: { value: Math.round(velocity * 10) / 10, weight: 0.3 },
    },
    rationale: generateScoreRationale(reach, sentiment, velocity, item),
    stakes: generateStakes(item, score),
  };
}

function generateScoreRationale(reach, sentiment, velocity, item) {
  const parts = [];
  if (reach >= 7) parts.push(`high visibility (${item.upvotes || 0} upvotes)`);
  else if (reach >= 4) parts.push('moderate reach');
  if (sentiment >= 8) parts.push('strong sentiment intensity');
  if (velocity >= 6) parts.push('rapid engagement growth');
  const duplicates = item.duplicateCount || 0;
  if (duplicates > 5) parts.push(`${duplicates}+ similar reports`);
  return parts.length > 0 ? `Score reflects ${parts.join(', ')}.` : 'Score based on standard engagement metrics.';
}

function generateStakes(item, score) {
  if (item.type === 'Constructive') {
    return score >= 7
      ? { type: 'risk', message: `Risk if ignored: Potential churn of ${item.problemMetadata?.userSegmentGuess || 'affected users'}, negative word-of-mouth amplification.` }
      : { type: 'risk', message: 'Risk if ignored: Continued user frustration, possible support ticket increase.' };
  }
  if (item.type === 'Praise') {
    return { type: 'upside', message: 'Upside if amplified: Social proof for marketing, potential case study opportunity.' };
  }
  return { type: 'neutral', message: 'Monitor for changes in sentiment or frequency.' };
}

const synthesisSchemaV2 = z.object({
  summaries: z.object({
    tldr: z.string().describe('One-sentence summary'),
    highlights: z.array(z.string()).length(5).describe('5 bullet point highlights'),
    executiveBrief: z.string().describe('2-3 paragraph executive summary'),
  }),
  sentiment: z.object({
    positive: z.number(),
    neutral: z.number(),
    negative: z.number(),
    mood: z.enum(['Thriving', 'Stable', 'Concerning', 'Critical']),
    moodExplanation: z.string(),
  }),
  focusAreas: z.array(z.object({
    id: z.string(),
    title: z.string(),
    category: z.enum(['feature_request', 'usability_friction', 'bug']),
    frequency: z.number(),
    severityLabel: z.enum(['Critical', 'High', 'Medium', 'Low']),
    topQuote: z.string(),
    rootCause: z.string(),
    affectedSegments: z.array(z.string()),
  })),
  brandStrengths: z.object({
    overallScore: z.number().min(0).max(10),
    topLoves: z.array(z.object({
      feature: z.string(),
      quote: z.string(),
      shareability: z.number(),
    })),
    brandPersonality: z.array(z.string()).describe('3 adjectives users associate with brand'),
  }),
  suggestedOKRs: z.array(z.object({
    theme: z.string(),
    objective: z.string(),
    keyResults: z.array(z.string()),
    timeframe: z.enum(['Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2']),
  })),
  priorityMatrix: z.array(z.object({
    title: z.string(),
    category: z.enum(['feature_request', 'usability_friction', 'bug']),
    impactScore: z.number(),
    effortEstimate: z.enum(['Quick Win', 'Medium', 'Large']),
    quadrant: z.enum(['Quick Wins', 'Strategic Investments', 'Fill-ins', 'Reconsider']),
    frequency: z.number(),
  })),
  expectationGaps: z.array(z.object({
    expectation: z.string(),
    reality: z.string(),
    gapSeverity: z.enum(['High', 'Medium', 'Low']),
    suggestedFix: z.string(),
  })),
  metadata: z.object({
    totalAnalyzed: z.number(),
    highSignalCount: z.number(),
    noiseFiltered: z.number(),
    dataSources: z.array(z.string()),
    analysisDate: z.string(),
  }),
});

function filterSignalFromNoise(analyzedItems) {
  const highSignal = [];
  const noise = [];

  for (const item of analyzedItems) {
    const signalScore = calculateSignalScore(item);
    const impactData = calculateImpactScore(item, analyzedItems.length);

    if (signalScore >= 0.5) {
      highSignal.push({ ...item, signalScore, impactData });
    } else {
      noise.push({ ...item, signalScore });
    }
  }

  highSignal.sort((a, b) => b.impactData.score - a.impactData.score);
  return { highSignal, noise };
}

function calculateSignalScore(item) {
  let score = 0.5;

  if (item.type === 'Constructive') score += 0.2;
  if (item.type === 'Praise') score += 0.1;

  const bodyLength = item.body?.length || item.content?.length || 0;
  if (bodyLength > 200) score += 0.1;
  if (bodyLength > 500) score += 0.1;

  const upvotes = item.upvotes || item.score || 0;
  if (upvotes > 10) score += 0.05;
  if (upvotes > 50) score += 0.1;
  if (upvotes > 100) score += 0.1;

  if (item.problemMetadata) {
    score += 0.1;
    if (item.problemMetadata.impactScore >= 7) score += 0.1;
  }

  if (item.category === 'Rant/Opinion') score -= 0.2;
  if (bodyLength < 50) score -= 0.2;

  return Math.max(0, Math.min(1, score));
}

function clusterIntoFocusAreas(items) {
  const areas = {};

  for (const item of items) {
    const featureArea = item.problemMetadata?.featureArea || item.delightMetadata?.ahaMoment || 'General';

    let category = 'usability_friction';
    if (item.category === 'Feature Request') category = 'feature_request';
    else if (item.category === 'Bug') category = 'bug';
    else if (item.type === 'Praise') category = 'praise';

    const key = `${category}:${featureArea}`;

    if (!areas[key]) {
      areas[key] = { id: key, title: featureArea, category, items: [], totalScore: 0, quotes: [], segments: new Set() };
    }

    areas[key].items.push(item);
    areas[key].totalScore += item.impactData?.score || 0;

    if (item.summary?.keyQuote) areas[key].quotes.push(item.summary.keyQuote);
    if (item.problemMetadata?.userSegmentGuess) areas[key].segments.add(item.problemMetadata.userSegmentGuess);
  }

  return Object.values(areas).map(area => ({
    ...area,
    frequency: area.items.length,
    avgImpact: area.items.length > 0 ? area.totalScore / area.items.length : 0,
    topQuote: area.quotes[0] || '',
    affectedSegments: Array.from(area.segments),
    stakes: area.items[0]?.impactData?.stakes || { type: 'neutral', message: '' },
    scoreRationale: area.items[0]?.impactData?.rationale || '',
  })).sort((a, b) => b.avgImpact - a.avgImpact);
}

function inferUserType(item) {
  const content = `${item.title || ''} ${item.body || item.content || ''}`.toLowerCase();

  if (content.includes('switched to') || content.includes('moved to') || content.includes('cancelled') || content.includes('used to use')) {
    return 'churned';
  }
  if (content.includes('new to') || content.includes('just started') || content.includes('beginner') || content.includes('first time')) {
    return 'new_user';
  }
  if (content.includes('power user') || content.includes('enterprise') || content.includes('automation') || content.includes('api')) {
    return 'power_user';
  }
  return 'general';
}

const synthesisPromptV2 = ChatPromptTemplate.fromMessages([
  ['system', `You are a Chief Product Officer creating an Apple-quality strategic report. Your output should be:
- Concise and impactful (no fluff)
- Data-driven with specific numbers
- Actionable with clear next steps
- Honest about both problems and strengths

## Focus Area Categories
- feature_request (Blue): New capabilities users want
- usability_friction (Orange): Confusing or difficult experiences
- bug (Red): Broken functionality

## Severity Levels
- Critical: Blocking users, causing churn
- High: Significant friction, workarounds needed
- Medium: Annoying but manageable
- Low: Minor inconvenience

## OKR Generation
Generate 3 suggested OKRs based on the findings. Each should be:
- Specific and measurable
- Tied directly to feedback themes
- Achievable within the timeframe`],

  ['human', `Create a strategic synthesis for {companyName}:

## Data Summary
- Total Feedback: {totalItems}
- High-Signal: {highSignalCount}
- Filtered Noise: {noiseCount}

## Type Distribution
- Constructive: {constructiveCount}
- Praise: {praiseCount}
- Neutral: {neutralCount}

## Top Focus Areas (by Impact Score)
{focusAreas}

## User Segment Distribution
- New Users: {newUserCount}
- Power Users: {powerUserCount}
- Churned/At-Risk: {churnedCount}

## Sample Evidence
{sampleQuotes}

Generate the complete synthesis with TL;DR, highlights, focus areas, brand strengths, and 3 suggested OKRs.`],
]);

const structuredLlmV2 = llm.withStructuredOutput(synthesisSchemaV2);
const synthesisChainV2 = synthesisPromptV2.pipe(structuredLlmV2);

export async function synthesizeFeedback(analyzedItems, companyName, previousSnapshot = null) {
  console.log('[Synthesis] Filtering and scoring items...');
  const signalData = filterSignalFromNoise(analyzedItems);
  console.log(`[Synthesis] High-signal: ${signalData.highSignal.length}, noise: ${signalData.noise.length}`);

  const focusAreas = clusterIntoFocusAreas(signalData.highSignal);
  console.log(`[Synthesis] Focus areas: ${focusAreas.length}`);

  const userTypes = { new_user: 0, power_user: 0, churned: 0, general: 0 };
  for (const item of signalData.highSignal) userTypes[inferUserType(item)]++;

  const typeDistribution = {
    constructive: analyzedItems.filter(i => i.type === 'Constructive').length,
    praise: analyzedItems.filter(i => i.type === 'Praise').length,
    neutral: analyzedItems.filter(i => i.type === 'Neutral').length,
  };

  const focusAreasText = focusAreas.slice(0, 10)
    .map(fa => `- ${fa.title} (${fa.category}): Impact ${fa.avgImpact.toFixed(1)}/10, ${fa.frequency} mentions`)
    .join('\n');

  const sampleQuotes = signalData.highSignal
    .filter(i => i.summary?.keyQuote)
    .slice(0, 20)
    .map(i => `"${i.summary.keyQuote}" [${i.category}]`)
    .join('\n');

  console.log('[Synthesis] Running LLM synthesis...');

  try {
    const synthesis = await synthesisChainV2.invoke({
      companyName,
      totalItems: analyzedItems.length,
      highSignalCount: signalData.highSignal.length,
      noiseCount: signalData.noise.length,
      constructiveCount: typeDistribution.constructive,
      praiseCount: typeDistribution.praise,
      neutralCount: typeDistribution.neutral,
      focusAreas: focusAreasText,
      newUserCount: userTypes.new_user,
      powerUserCount: userTypes.power_user,
      churnedCount: userTypes.churned,
      sampleQuotes,
    });

    const enhancedFocusAreas = focusAreas.slice(0, 10).map((fa, idx) => ({
      ...fa,
      ...synthesis.focusAreas[idx],
      impactScore: fa.avgImpact,
      trend: previousSnapshot ? calculateTrend(fa, previousSnapshot) : 'new',
      trendDelta: previousSnapshot ? calculateTrendDelta(fa, previousSnapshot) : 0,
    }));

    const result = {
      ...synthesis,
      focusAreas: enhancedFocusAreas,
      metadata: {
        totalAnalyzed: analyzedItems.length,
        highSignalCount: signalData.highSignal.length,
        noiseFiltered: signalData.noise.length,
        dataSources: ['Reddit'],
        analysisDate: new Date().toISOString(),
      },
      rawScores: signalData.highSignal.map(item => ({
        id: item.sourceId || item.id,
        impactData: item.impactData,
      })),
    };

    console.log('[Synthesis] Complete');
    return result;
  } catch (error) {
    console.error('[Synthesis] Error:', error.message);
    throw error;
  }
}

function calculateTrend(currentArea, previousSnapshot) {
  if (!previousSnapshot?.focusAreas) return 'new';
  const previous = previousSnapshot.focusAreas.find(
    fa => fa.title === currentArea.title && fa.category === currentArea.category
  );
  if (!previous) return 'new';
  const delta = currentArea.frequency - previous.frequency;
  if (delta > 2) return 'up';
  if (delta < -2) return 'down';
  return 'stable';
}

function calculateTrendDelta(currentArea, previousSnapshot) {
  if (!previousSnapshot?.focusAreas) return 0;
  const previous = previousSnapshot.focusAreas.find(
    fa => fa.title === currentArea.title && fa.category === currentArea.category
  );
  if (!previous) return currentArea.frequency;
  return currentArea.frequency - previous.frequency;
}

export function createSnapshot(synthesis, companyName) {
  return {
    id: `snapshot_${Date.now()}`,
    companyName,
    createdAt: new Date().toISOString(),
    focusAreas: synthesis.focusAreas.map(fa => ({
      title: fa.title,
      category: fa.category,
      frequency: fa.frequency,
      impactScore: fa.impactScore,
    })),
    sentiment: synthesis.sentiment,
    metadata: synthesis.metadata,
  };
}

export function formatSynthesisReport(synthesis, companyName) {
  const lines = [];

  lines.push('═'.repeat(70));
  lines.push(`  THREADER AI STRATEGIC REPORT: ${companyName.toUpperCase()}`);
  lines.push(`  Generated: ${synthesis.metadata?.analysisDate || new Date().toISOString()}`);
  lines.push('═'.repeat(70));

  lines.push('\n📌 TL;DR');
  lines.push('─'.repeat(40));
  lines.push(`  ${synthesis.summaries?.tldr || 'No summary available'}`);

  if (synthesis.summaries?.highlights) {
    lines.push('\n✨ HIGHLIGHTS');
    lines.push('─'.repeat(40));
    synthesis.summaries.highlights.forEach((h, i) => lines.push(`  ${i + 1}. ${h}`));
  }

  if (synthesis.focusAreas?.length > 0) {
    lines.push('\n🎯 FOCUS AREAS');
    lines.push('─'.repeat(40));
    synthesis.focusAreas.slice(0, 5).forEach((fa, i) => {
      const trend = fa.trend === 'up' ? '↑' : fa.trend === 'down' ? '↓' : '→';
      lines.push(`  ${i + 1}. [${fa.category}] ${fa.title} ${trend}`);
      lines.push(`     Impact: ${fa.impactScore?.toFixed(1) || 'N/A'}/10 | Freq: ${fa.frequency}`);
      if (fa.topQuote) lines.push(`     "${fa.topQuote}"`);
    });
  }

  if (synthesis.brandStrengths?.topLoves?.length > 0) {
    lines.push('\n💜 WHAT USERS LOVE');
    lines.push('─'.repeat(40));
    lines.push(`  Brand Strength Score: ${synthesis.brandStrengths.overallScore}/10`);
    synthesis.brandStrengths.topLoves.forEach((love, i) => {
      lines.push(`  ${i + 1}. ${love.feature}`);
      lines.push(`     "${love.quote}"`);
    });
  }

  if (synthesis.suggestedOKRs?.length > 0) {
    lines.push('\n🎯 SUGGESTED OKRs');
    lines.push('─'.repeat(40));
    synthesis.suggestedOKRs.forEach((okr, i) => {
      lines.push(`  ${i + 1}. [${okr.timeframe}] ${okr.theme}`);
      lines.push(`     Objective: ${okr.objective}`);
      okr.keyResults.forEach(kr => lines.push(`     • ${kr}`));
    });
  }

  lines.push('\n' + '═'.repeat(70));
  return lines.join('\n');
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not set');
    process.exit(1);
  }

  const mockItems = [
    {
      type: 'Constructive',
      category: 'Usability Friction',
      problemMetadata: { featureArea: 'Database Performance', impactScore: 9, userSegmentGuess: 'Power Users' },
      summary: { keyQuote: 'Database freezes with large tables' },
      upvotes: 234,
      numComments: 89,
      title: 'Performance issues',
      body: 'Large databases freeze for 30+ seconds',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      type: 'Praise',
      category: 'N/A',
      delightMetadata: { ahaMoment: 'AI Features', shareability: 9 },
      summary: { keyQuote: 'AI saved me hours of work!' },
      upvotes: 156,
      numComments: 23,
      title: 'AI is amazing',
      body: 'Just used AI to summarize 50 pages of notes',
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const synthesis = await synthesizeFeedback(mockItems, 'Notion');
  console.log(formatSynthesisReport(synthesis, 'Notion'));
}

// only run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
