import { smartScrape } from './scrapers/redditScraper.js';
import { classifyFeedbackBatch, generateExecutiveSummary } from './analysis/classifier.js';
import { synthesizeFeedback, formatSynthesisReport } from './analysis/synthesizer.js';
import {
  supabaseAdmin,
  insertFeedbackItems,
  getOrCreateCompany,
  createScrapeJob,
  updateScrapeJob,
} from './db/supabase.js';
import dotenv from 'dotenv';

dotenv.config();

export async function runPipeline(companyName, tenantId, options = {}) {
  const {
    maxItemsPerSubreddit = 100,
    skipClassification = false,
    skipStorage = false,
  } = options;

  console.log(`[Pipeline] Starting for ${companyName} (tenant: ${tenantId})`);

  const pipelineResults = {
    companyName,
    tenantId,
    scrapeResults: null,
    classificationResults: null,
    executiveSummary: null,
    strategicSynthesis: null,
    errors: [],
  };

  let company = null;
  if (!skipStorage && supabaseAdmin) {
    try {
      company = await getOrCreateCompany(tenantId, companyName);
      console.log(`[Pipeline] Company ID: ${company.id}`);
    } catch (error) {
      console.warn('[Pipeline] Could not create company record:', error.message);
    }
  }

  let job = null;
  try {
    if (company && supabaseAdmin) {
      job = await createScrapeJob(tenantId, company.id, 'reddit');
    }

    const scrapeResults = await smartScrape(companyName, { maxItemsPerSubreddit });
    pipelineResults.scrapeResults = scrapeResults;

    if (job) {
      await updateScrapeJob(job.id, {
        items_found: scrapeResults.mentions.length,
        status: 'completed',
        completed_at: new Date().toISOString(),
      });
    }

    console.log(`[Pipeline] Scraped ${scrapeResults.mentions.length} relevant posts`);
  } catch (error) {
    console.error('[Pipeline] Scraping error:', error.message);
    pipelineResults.errors.push({ step: 'scraping', error: error.message });

    if (job) {
      await updateScrapeJob(job.id, {
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString(),
      });
    }
  }

  if (!skipClassification && pipelineResults.scrapeResults?.mentions?.length > 0) {
    try {
      const classificationResults = await classifyFeedbackBatch(
        pipelineResults.scrapeResults.mentions,
        { batchSize: 5 }
      );

      pipelineResults.classificationResults = classificationResults;
      pipelineResults.executiveSummary = generateExecutiveSummary(classificationResults, companyName);

      console.log(`[Pipeline] Classification complete`);
      console.log(`  Constructive: ${classificationResults.stats.constructive}`);
      console.log(`  Praise: ${classificationResults.stats.praise}`);
      console.log(`  Neutral: ${classificationResults.stats.neutral}`);
    } catch (error) {
      console.error('[Pipeline] Classification error:', error.message);
      pipelineResults.errors.push({ step: 'classification', error: error.message });
    }
  } else if (skipClassification) {
    console.log('[Pipeline] Skipping classification (skipClassification=true)');
  } else {
    console.log('[Pipeline] Skipping classification (no items to classify)');
  }

  if (pipelineResults.classificationResults?.items?.length >= 5) {
    try {
      const synthesis = await synthesizeFeedback(
        pipelineResults.classificationResults.items,
        companyName
      );
      pipelineResults.strategicSynthesis = synthesis;
      console.log('[Pipeline] Strategic synthesis complete');
    } catch (error) {
      console.error('[Pipeline] Synthesis error:', error.message);
      pipelineResults.errors.push({ step: 'synthesis', error: error.message });
    }
  } else {
    console.log('[Pipeline] Skipping synthesis (need at least 5 classified items)');
  }

  if (!skipStorage && company && supabaseAdmin && pipelineResults.classificationResults) {
    try {
      const itemsToStore = pipelineResults.classificationResults.items.map(item => ({
        ...pipelineResults.scrapeResults.mentions.find(m => m.sourceId === item.sourceId),
        classification: item,
      }));

      await insertFeedbackItems(tenantId, company.id, itemsToStore);
      console.log(`[Pipeline] Stored ${itemsToStore.length} items`);
    } catch (error) {
      console.error('[Pipeline] Storage error:', error.message);
      pipelineResults.errors.push({ step: 'storage', error: error.message });
    }
  } else if (skipStorage) {
    console.log('[Pipeline] Skipping storage (skipStorage=true)');
  } else if (!supabaseAdmin) {
    console.log('[Pipeline] Skipping storage (Supabase not configured)');
  }

  console.log('[Pipeline] Complete');

  if (pipelineResults.executiveSummary) {
    const summary = pipelineResults.executiveSummary;
    console.log(`\nOverview: ${summary.overview.totalFeedback} total, ${summary.overview.constructive} constructive, ${summary.overview.praise} praise`);

    if (summary.topIssues.length > 0) {
      console.log('\nTop Issues:');
      summary.topIssues.forEach((issue, i) => {
        console.log(`  ${i + 1}. [${issue.category}] ${issue.title}`);
        console.log(`     Impact: ${issue.impactScore}/10 | Urgency: ${issue.urgencyScore}/10`);
        console.log(`     → ${issue.actionableInsight}`);
      });
    }

    if (summary.topTestimonials.length > 0) {
      console.log('\nTop Testimonials:');
      summary.topTestimonials.forEach((t, i) => {
        console.log(`  ${i + 1}. "${t.quote}" (shareability: ${t.shareability}/10)`);
      });
    }
  }

  if (pipelineResults.errors.length > 0) {
    console.log('\nErrors:');
    pipelineResults.errors.forEach(e => console.log(`  - ${e.step}: ${e.error}`));
  }

  if (pipelineResults.strategicSynthesis) {
    console.log(formatSynthesisReport(pipelineResults.strategicSynthesis, companyName));
  }

  return pipelineResults;
}

async function main() {
  const companyName = process.argv[2] || 'Notion';
  const tenantId = process.argv[3] || 'test-tenant-id';

  if (!process.env.OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY');
    process.exit(1);
  }

  try {
    const results = await runPipeline(companyName, tenantId, {
      maxItemsPerSubreddit: 50,
      skipStorage: !process.env.SUPABASE_URL,
    });

    console.log(JSON.stringify(results.strategicSynthesis || results.executiveSummary, null, 2));
  } catch (error) {
    console.error('Pipeline failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
