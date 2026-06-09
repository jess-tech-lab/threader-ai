/**
 * Threader AI - Senior Product Strategist Classifier
 * Analyzes product feedback and returns structured strategic insights
 */

import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// Initialize the LLM
const llm = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0.1,
});

// ============================================================================
// SCHEMA DEFINITIONS
// ============================================================================

// Problem Metadata (for Constructive feedback)
const problemMetadataSchema = z.object({
  rootCause: z.enum([
    'Speed',
    'Certainty',
    'Ease',
    'Control',
    'Status',
    'Trust',
    'Cost',
    'Integration',
    'Reliability',
    'Other',
  ]).describe('The underlying human need driving this feedback'),

  featureArea: z.string().describe('The product area affected (e.g., Onboarding, Checkout, Mobile, Dashboard, API, Settings)'),

  impactType: z.enum([
    'Revenue',
    'Retention',
    'Brand Trust',
    'Cost to Serve',
  ]).describe('Primary business impact of this issue'),

  urgencySignal: z.enum([
    'Critical',
    'High',
    'Low',
  ]).describe('How urgent is addressing this feedback'),

  prioritization: z.object({
    impactScore: z.number().min(1).max(10).describe('Business impact score (1=minimal, 10=critical)'),
    urgencyScore: z.number().min(1).max(10).describe('Time sensitivity (1=can wait, 10=immediate)'),
    effortEstimate: z.number().min(1).max(5).describe('Implementation effort (1=trivial, 5=major project)'),
  }).describe('Prioritization scores for product roadmap'),
});

// Delight Metadata (for Praise feedback)
const delightMetadataSchema = z.object({
  ahaMoment: z.string().describe('Describe exactly what made the user happy - the specific feature or experience'),

  valuePropValidation: z.string().describe('Which marketing claim or value proposition does this praise prove true?'),

  shareability: z.number().min(1).max(10).describe('How good would this be for a marketing testimonial? (1=not usable, 10=perfect testimonial)'),
});

// Main classification schema
const classificationSchema = z.object({
  // Primary Classification
  type: z.enum([
    'Constructive',
    'Praise',
    'Neutral',
  ]).describe('Primary feedback type'),

  category: z.enum([
    'Feature Request',
    'Usability Friction',
    'Support Question',
    'Rant/Opinion',
    'N/A',
  ]).describe('Category for Constructive feedback, N/A for others'),

  // Conditional Metadata
  problemMetadata: problemMetadataSchema.nullable().describe('Detailed problem analysis (only for Constructive type)'),

  delightMetadata: delightMetadataSchema.nullable().describe('Delight analysis (only for Praise type)'),

  // Output Summary
  summary: z.object({
    actionableInsight: z.string().describe('A 1-sentence strategic recommendation for the product team'),

    replyDraft: z.string().describe('A context-aware, empathetic response suitable for social media (2-3 sentences)'),

    keyQuote: z.string().describe('The most impactful quote from the feedback (verbatim if possible)'),
  }),

  // Metadata
  confidence: z.number().min(0).max(1).describe('Classification confidence score'),
  reasoning: z.string().describe('Brief explanation of the classification decisions'),
});

// ============================================================================
// PROMPT TEMPLATE
// ============================================================================

const classificationPrompt = ChatPromptTemplate.fromMessages([
  ['system', `You are a Senior Product Strategist at a world-class product analytics firm. Your job is to analyze user feedback from social media and forums, extracting strategic insights that drive product decisions.

## Your Analysis Framework

### 1. PRIMARY CLASSIFICATION
Determine the feedback type:
- **Constructive**: Actionable feedback that identifies problems, requests features, or asks questions
- **Praise**: Positive feedback expressing satisfaction, delight, or appreciation
- **Neutral**: Informational posts, general discussion, or unclear sentiment

For Constructive feedback, categorize into exactly one:
- **Feature Request**: User wants new functionality or capabilities
- **Usability Friction**: User struggles with existing features (confusing UI, workflow issues)
- **Support Question**: User needs help understanding or using the product
- **Rant/Opinion**: Emotional venting, often without specific actionable points

### 2. PROBLEM METADATA (Constructive only)
Dig deeper into the underlying issue:

**Root Cause** - What human need is unmet?
- Speed: User needs things faster
- Certainty: User needs predictability/reliability
- Ease: User needs simplicity
- Control: User needs customization/flexibility
- Status: User needs to look good to others
- Trust: User needs security/privacy assurance
- Cost: User needs better value
- Integration: User needs to connect with other tools
- Reliability: User needs consistent performance

**Feature Area**: Identify the specific product area (be specific: "Database Views", "Mobile Sync", "Team Permissions")

**Impact Type**:
- Revenue: Affects purchases, upgrades, or monetization
- Retention: Affects churn or continued usage
- Brand Trust: Affects reputation and word-of-mouth
- Cost to Serve: Affects support burden or operational costs

**Prioritization**:
- Impact Score (1-10): How significant is the business impact?
- Urgency Score (1-10): How time-sensitive is this?
- Effort Estimate (1-5): How hard to fix? (1=config change, 5=major engineering)

### 3. DELIGHT METADATA (Praise only)
Extract marketing gold:
- **Aha! Moment**: What specific experience delighted them?
- **Value Prop Validation**: Which of the company's promises does this prove?
- **Shareability (1-10)**: How usable is this for marketing? Consider specificity, authenticity, and quotability.

### 4. OUTPUT SUMMARY
Always provide:
- **Actionable Insight**: One strategic recommendation (start with a verb: "Prioritize...", "Investigate...", "Amplify...")
- **Reply Draft**: A helpful, empathetic response for social media. Be human, not corporate.
- **Key Quote**: The most impactful verbatim quote from the feedback

## Guidelines
- Be objective and data-driven
- Focus on strategic value, not just classification
- For Neutral posts, problemMetadata and delightMetadata should be null
- Reply drafts should acknowledge the user's experience and provide value`],

  ['human', `Analyze this feedback about {companyName}:

**Source**: {source} (r/{subreddit})
**Title**: {title}
**Content**: {body}
**Engagement**: {upvotes} upvotes, {commentCount} comments
**URL**: {sourceUrl}

Provide your strategic analysis.`],
]);

// Create the structured output chain
const structuredLlm = llm.withStructuredOutput(classificationSchema);
const classificationChain = classificationPrompt.pipe(structuredLlm);

// ============================================================================
// CLASSIFICATION FUNCTIONS
// ============================================================================

/**
 * Classify a single feedback item with strategic analysis
 * @param {Object} feedbackItem - The feedback item to classify
 * @returns {Promise<Object>} Strategic classification result
 */
export async function classifyFeedback(feedbackItem) {
  try {
    const result = await classificationChain.invoke({
      companyName: feedbackItem.companyName || 'the product',
      source: feedbackItem.source || 'reddit',
      subreddit: feedbackItem.subreddit || 'unknown',
      title: feedbackItem.title || '(No title)',
      body: feedbackItem.body || '',
      upvotes: feedbackItem.upvotes || 0,
      commentCount: feedbackItem.commentCount || 0,
      sourceUrl: feedbackItem.sourceUrl || '',
    });

    return {
      ...result,
      sourceUrl: feedbackItem.sourceUrl,
      sourceId: feedbackItem.sourceId,
      originalTitle: feedbackItem.title,
    };
  } catch (error) {
    console.error('[Classifier] Error classifying feedback:', error.message);
    return {
      type: 'Neutral',
      category: 'N/A',
      problemMetadata: null,
      delightMetadata: null,
      summary: {
        actionableInsight: 'Unable to classify - review manually',
        replyDraft: 'Thank you for your feedback!',
        keyQuote: '',
      },
      confidence: 0,
      reasoning: `Classification error: ${error.message}`,
      sourceUrl: feedbackItem.sourceUrl,
      sourceId: feedbackItem.sourceId,
    };
  }
}

/**
 * Classify multiple feedback items with rate limiting
 * @param {Array} feedbackItems - Array of feedback items
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Classified results with summary stats
 */
export async function classifyFeedbackBatch(feedbackItems, options = {}) {
  const { batchSize = 5, onProgress = null } = options;

  console.log(`[Classifier] Analyzing ${feedbackItems.length} items as Senior Product Strategist...`);

  const results = {
    items: [],
    stats: {
      total: feedbackItems.length,
      constructive: 0,
      praise: 0,
      neutral: 0,
      byCategory: {},
      byImpactType: {},
      avgImpactScore: 0,
      avgUrgencyScore: 0,
    },
  };

  let impactSum = 0;
  let urgencySum = 0;
  let scoredCount = 0;

  for (let i = 0; i < feedbackItems.length; i += batchSize) {
    const batch = feedbackItems.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(feedbackItems.length / batchSize);

    console.log(`[Classifier] Processing batch ${batchNum}/${totalBatches}...`);

    const batchResults = await Promise.all(
      batch.map(item => classifyFeedback(item))
    );

    // Process results and update stats
    for (const result of batchResults) {
      results.items.push(result);

      // Update type counts
      if (result.type === 'Constructive') {
        results.stats.constructive++;
        results.stats.byCategory[result.category] = (results.stats.byCategory[result.category] || 0) + 1;

        if (result.problemMetadata) {
          results.stats.byImpactType[result.problemMetadata.impactType] =
            (results.stats.byImpactType[result.problemMetadata.impactType] || 0) + 1;

          impactSum += result.problemMetadata.prioritization.impactScore;
          urgencySum += result.problemMetadata.prioritization.urgencyScore;
          scoredCount++;
        }
      } else if (result.type === 'Praise') {
        results.stats.praise++;
      } else {
        results.stats.neutral++;
      }
    }

    if (onProgress) {
      onProgress({
        processed: Math.min(i + batchSize, feedbackItems.length),
        total: feedbackItems.length,
      });
    }

    // Rate limiting between batches
    if (i + batchSize < feedbackItems.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Calculate averages
  if (scoredCount > 0) {
    results.stats.avgImpactScore = Math.round((impactSum / scoredCount) * 10) / 10;
    results.stats.avgUrgencyScore = Math.round((urgencySum / scoredCount) * 10) / 10;
  }

  console.log(`[Classifier] Analysis complete!`);
  console.log(`  Constructive: ${results.stats.constructive}`);
  console.log(`  Praise: ${results.stats.praise}`);
  console.log(`  Neutral: ${results.stats.neutral}`);

  return results;
}

/**
 * Generate an executive summary from classified feedback
 * @param {Object} classifiedResults - Results from classifyFeedbackBatch
 * @param {string} companyName - The company name
 * @returns {Object} Executive summary
 */
export function generateExecutiveSummary(classifiedResults, companyName) {
  const { items, stats } = classifiedResults;

  // Get top issues (highest impact + urgency scores)
  const constructiveItems = items.filter(i => i.type === 'Constructive' && i.problemMetadata);
  const topIssues = constructiveItems
    .sort((a, b) => {
      const scoreA = a.problemMetadata.prioritization.impactScore + a.problemMetadata.prioritization.urgencyScore;
      const scoreB = b.problemMetadata.prioritization.impactScore + b.problemMetadata.prioritization.urgencyScore;
      return scoreB - scoreA;
    })
    .slice(0, 5);

  // Get best testimonials
  const praiseItems = items.filter(i => i.type === 'Praise' && i.delightMetadata);
  const topTestimonials = praiseItems
    .sort((a, b) => b.delightMetadata.shareability - a.delightMetadata.shareability)
    .slice(0, 3);

  // Group by feature area
  const byFeatureArea = {};
  constructiveItems.forEach(item => {
    const area = item.problemMetadata.featureArea;
    if (!byFeatureArea[area]) {
      byFeatureArea[area] = { count: 0, avgImpact: 0, items: [] };
    }
    byFeatureArea[area].count++;
    byFeatureArea[area].avgImpact += item.problemMetadata.prioritization.impactScore;
    byFeatureArea[area].items.push(item);
  });

  // Calculate averages for feature areas
  Object.keys(byFeatureArea).forEach(area => {
    byFeatureArea[area].avgImpact = Math.round(
      (byFeatureArea[area].avgImpact / byFeatureArea[area].count) * 10
    ) / 10;
  });

  return {
    companyName,
    analyzedAt: new Date().toISOString(),
    overview: {
      totalFeedback: stats.total,
      constructive: stats.constructive,
      praise: stats.praise,
      neutral: stats.neutral,
      constructiveRate: Math.round((stats.constructive / stats.total) * 100),
      praiseRate: Math.round((stats.praise / stats.total) * 100),
    },
    prioritization: {
      avgImpactScore: stats.avgImpactScore,
      avgUrgencyScore: stats.avgUrgencyScore,
      byCategory: stats.byCategory,
      byImpactType: stats.byImpactType,
    },
    topIssues: topIssues.map(item => ({
      title: item.originalTitle,
      category: item.category,
      featureArea: item.problemMetadata.featureArea,
      impactScore: item.problemMetadata.prioritization.impactScore,
      urgencyScore: item.problemMetadata.prioritization.urgencyScore,
      actionableInsight: item.summary.actionableInsight,
      sourceUrl: item.sourceUrl,
    })),
    topTestimonials: topTestimonials.map(item => ({
      quote: item.summary.keyQuote,
      ahaMoment: item.delightMetadata.ahaMoment,
      valuePropValidation: item.delightMetadata.valuePropValidation,
      shareability: item.delightMetadata.shareability,
      sourceUrl: item.sourceUrl,
    })),
    featureAreaBreakdown: Object.entries(byFeatureArea)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([area, data]) => ({
        area,
        issueCount: data.count,
        avgImpact: data.avgImpact,
      })),
  };
}

// ============================================================================
// CLI EXECUTION
// ============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('Threader AI - Senior Product Strategist Classifier');
  console.log('='.repeat(60));

  if (!process.env.OPENAI_API_KEY) {
    console.error('\nError: OPENAI_API_KEY not set');
    console.error('Please add your OpenAI API key to .env');
    process.exit(1);
  }

  // Test with sample feedback items
  const testItems = [
    {
      sourceId: 'test-1',
      companyName: 'Notion',
      source: 'reddit',
      subreddit: 'Notion',
      title: 'Database keeps crashing with large datasets',
      body: 'Every time I try to open my project database with over 1000 entries, Notion freezes for 30+ seconds and sometimes crashes completely. I\'m on the Team plan paying $10/user/month and this is blocking our sprint planning. We\'ve been loyal customers for 2 years but honestly considering Airtable at this point. Anyone else experiencing this?',
      sourceUrl: 'https://reddit.com/r/Notion/comments/abc123',
      upvotes: 234,
      commentCount: 67,
    },
    {
      sourceId: 'test-2',
      companyName: 'Notion',
      source: 'reddit',
      subreddit: 'Notion',
      title: 'Notion AI just saved me 3 hours of work!',
      body: 'I had to summarize 50 pages of meeting notes for a board presentation. Used Notion AI and it created a perfect executive summary in seconds. The quality was better than what I would have written myself. This is exactly why I upgraded to Plus. Game changer for busy professionals!',
      sourceUrl: 'https://reddit.com/r/Notion/comments/def456',
      upvotes: 156,
      commentCount: 23,
    },
    {
      sourceId: 'test-3',
      companyName: 'Notion',
      source: 'reddit',
      subreddit: 'Notion',
      title: 'How do I create a relation between two databases?',
      body: 'New to Notion. I have a Projects database and a Tasks database. How do I link them so tasks show up under their project? The documentation is confusing.',
      sourceUrl: 'https://reddit.com/r/Notion/comments/ghi789',
      upvotes: 12,
      commentCount: 5,
    },
  ];

  console.log(`\nAnalyzing ${testItems.length} test feedback items...\n`);

  const results = await classifyFeedbackBatch(testItems);

  // Display detailed results
  console.log('\n' + '='.repeat(60));
  console.log('DETAILED ANALYSIS');
  console.log('='.repeat(60));

  results.items.forEach((result, index) => {
    console.log(`\n[${ index + 1}] ${testItems[index].title}`);
    console.log('-'.repeat(50));
    console.log(`Type: ${result.type} | Category: ${result.category}`);
    console.log(`Confidence: ${(result.confidence * 100).toFixed(0)}%`);

    if (result.problemMetadata) {
      console.log(`\nProblem Analysis:`);
      console.log(`  Root Cause: ${result.problemMetadata.rootCause}`);
      console.log(`  Feature Area: ${result.problemMetadata.featureArea}`);
      console.log(`  Impact Type: ${result.problemMetadata.impactType}`);
      console.log(`  Urgency: ${result.problemMetadata.urgencySignal}`);
      console.log(`  Scores: Impact=${result.problemMetadata.prioritization.impactScore}/10, ` +
                  `Urgency=${result.problemMetadata.prioritization.urgencyScore}/10, ` +
                  `Effort=${result.problemMetadata.prioritization.effortEstimate}/5`);
    }

    if (result.delightMetadata) {
      console.log(`\nDelight Analysis:`);
      console.log(`  Aha! Moment: ${result.delightMetadata.ahaMoment}`);
      console.log(`  Value Prop: ${result.delightMetadata.valuePropValidation}`);
      console.log(`  Shareability: ${result.delightMetadata.shareability}/10`);
    }

    console.log(`\nStrategic Output:`);
    console.log(`  Insight: ${result.summary.actionableInsight}`);
    console.log(`  Reply: ${result.summary.replyDraft}`);
    console.log(`  Key Quote: "${result.summary.keyQuote}"`);
  });

  // Generate executive summary
  console.log('\n' + '='.repeat(60));
  console.log('EXECUTIVE SUMMARY');
  console.log('='.repeat(60));

  const summary = generateExecutiveSummary(results, 'Notion');
  console.log(JSON.stringify(summary, null, 2));
}

// Run if executed directly
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch(console.error);
}
