#!/usr/bin/env node
import { smartScrape } from './scrapers/redditScraper.js';
import { classifyFeedbackBatch, generateExecutiveSummary } from './analysis/classifier.js';
import { synthesizeFeedback, formatSynthesisReport } from './analysis/synthesizer.js';
import {
  supabaseAdmin,
  insertFeedbackItems,
  getOrCreateCompany,
  getOrCreateTenant,
  createScrapeJob,
  updateScrapeJob,
} from './db/supabase.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_TENANT_ID = 'system_admin';

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { companyName: null, tenantId: DEFAULT_TENANT_ID, help: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') result.help = true;
    else if (arg === '--tenant' || arg === '-t') result.tenantId = args[++i];
    else if (!arg.startsWith('-')) result.companyName = arg;
  }

  return result;
}

function printHelp() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                  Threader AI - Terminal Scout                 ║
╠═══════════════════════════════════════════════════════════════╣
║  Analyze company feedback from Reddit using AI                ║
╚═══════════════════════════════════════════════════════════════╝

Usage:
  npm run scout <company_name> [options]

Arguments:
  company_name     Name of the company to analyze (required)

Options:
  --tenant, -t     Tenant ID for multi-tenancy (default: system_admin)
  --help, -h       Show this help message

Examples:
  npm run scout "Notion"
  npm run scout "Linear" --tenant "my-org-123"
  npm run scout "Figma" -t "design-team"

Environment Variables:
  OPENAI_API_KEY           Required for LLM analysis
  SUPABASE_URL             Required for database storage
  SUPABASE_SERVICE_ROLE_KEY  Required for bypassing RLS
`);
}

// Writes synthesis to frontend/public/demo-config.json so the frontend can load it immediately
function saveToLocalFile(companyName, synthesis, metadata = {}) {
  const demoConfigPath = path.join(__dirname, '../frontend/public/demo-config.json');

  const config = {
    companyName,
    synthesis,
    metadata: { ...metadata, created_by: 'terminal_scout', version: '2.0' },
    lastUpdated: new Date().toISOString(),
  };

  fs.writeFileSync(demoConfigPath, JSON.stringify(config, null, 2));

  console.log(`\n[Scout] 📁 Saved to local file: ${demoConfigPath}`);
  console.log(`[Scout]    File size: ${(JSON.stringify(config).length / 1024).toFixed(1)} KB`);

  return config;
}

async function saveSnapshot(tenantId, companyId, companyName, synthesis, metadata = {}) {
  console.log(`\n[Scout] 💾 Saving snapshot for: ${companyName}`);

  const localResult = saveToLocalFile(companyName, synthesis, metadata);
  let reportUuid = null;

  if (supabaseAdmin) {
    console.log(`[Scout]    Also saving to Supabase...`);

    try {
      const { data, error } = await supabaseAdmin
        .from('snapshots')
        .insert({
          company_name: companyName,
          report_data: synthesis,
          is_public: true,
          tenant_id: tenantId || 'public',
        })
        .select('id, created_at')
        .single();

      if (error) {
        if (error.code === '42P01') {
          console.warn('[Scout] ⚠️  Supabase snapshots table does not exist');
          console.warn('[Scout]    Run the migration: sql/migrations/001_create_snapshots_table.sql');
        } else {
          console.warn(`[Scout] ⚠️  Supabase save failed: ${error.message}`);
        }
        console.log(`[Scout]    Using local file as fallback`);
      } else {
        reportUuid = data.id;
        console.log(`[Scout] ✅ Saved to Supabase (UUID: ${reportUuid})`);
      }
    } catch (err) {
      console.warn(`[Scout] ⚠️  Supabase error: ${err.message}`);
    }
  } else {
    console.log(`[Scout]    Supabase not configured — local file only`);
  }

  console.log(`\n[Scout] 🔗 Report URLs:`);
  if (reportUuid) console.log(`[Scout]    📌 http://localhost:5173/report/${reportUuid}`);
  console.log(`[Scout]    📝 http://localhost:5173/?company=${encodeURIComponent(companyName)}`);
  console.log(`[Scout] ✅ Report ready!`);

  return { uuid: reportUuid, localResult };
}

async function scout(companyName, tenantId) {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                  Threader AI - Terminal Scout                 ║
╠═══════════════════════════════════════════════════════════════╣
║  Company: ${companyName.padEnd(50)}                           ║
║  Tenant:  ${tenantId.padEnd(50)}                              ║
╚═══════════════════════════════════════════════════════════════╝
`);

  const startTime = Date.now();
  const results = {
    companyName,
    tenantId,
    scrapeResults: null,
    classificationResults: null,
    executiveSummary: null,
    strategicSynthesis: null,
    snapshot: null,
    errors: [],
  };

  let company = null;
  let tenantUuid = null;
  if (supabaseAdmin) {
    try {
      tenantUuid = await getOrCreateTenant(tenantId);
      company = await getOrCreateCompany(tenantUuid, companyName);
      console.log(`[Scout] Company ID: ${company.id}`);
    } catch (error) {
      console.warn('[Scout] Could not create company record:', error.message);
    }
  }

  console.log('\n┌─ Step 1: Smart Scraping ─────────────────────────────────┐');
  let job = null;
  try {
    if (company && supabaseAdmin) {
      job = await createScrapeJob(tenantUuid, company.id, 'reddit');
    }

    const scrapeResults = await smartScrape(companyName, { maxItemsPerSubreddit: 50 });
    results.scrapeResults = scrapeResults;

    if (job) {
      await updateScrapeJob(job.id, {
        items_found: scrapeResults.mentions.length,
        status: 'completed',
        completed_at: new Date().toISOString(),
      });
    }

    console.log(`└─ Scraped ${scrapeResults.mentions.length} posts`);
  } catch (error) {
    console.error('└─ Scraping error:', error.message);
    results.errors.push({ step: 'scraping', error: error.message });

    if (job) {
      await updateScrapeJob(job.id, { status: 'failed', error_message: error.message, completed_at: new Date().toISOString() });
    }
  }

  if (results.scrapeResults?.mentions?.length > 0) {
    console.log('\n┌─ Step 2: AI Classification ──────────────────────────────┐');
    try {
      const classificationResults = await classifyFeedbackBatch(results.scrapeResults.mentions, { batchSize: 5 });
      results.classificationResults = classificationResults;
      results.executiveSummary = generateExecutiveSummary(classificationResults, companyName);

      console.log(`│  Constructive: ${classificationResults.stats.constructive}`);
      console.log(`│  Praise:       ${classificationResults.stats.praise}`);
      console.log(`│  Neutral:      ${classificationResults.stats.neutral}`);
      console.log('└─ Classification complete');
    } catch (error) {
      console.error('└─ Classification error:', error.message);
      results.errors.push({ step: 'classification', error: error.message });
    }
  } else {
    console.log('\n┌─ Step 2: AI Classification ──────────────────────────────┐');
    console.log('└─ Skipped (no items to classify)');
  }

  if (results.classificationResults?.items?.length >= 5) {
    console.log('\n┌─ Step 3: Strategic Synthesis ────────────────────────────┐');
    try {
      const synthesis = await synthesizeFeedback(results.classificationResults.items, companyName);
      results.strategicSynthesis = synthesis;
      console.log('└─ Strategic synthesis complete');
    } catch (error) {
      console.error('└─ Synthesis error:', error.message);
      results.errors.push({ step: 'synthesis', error: error.message });
    }
  } else {
    console.log('\n┌─ Step 3: Strategic Synthesis ────────────────────────────┐');
    console.log('└─ Skipped (need at least 5 classified items)');
  }

  console.log('\n┌─ Step 4: Save Results ───────────────────────────────────┐');

  let reportUuid = null;
  if (results.strategicSynthesis) {
    try {
      const saveResult = await saveSnapshot(
        tenantUuid || tenantId,
        company?.id || null,
        companyName,
        results.strategicSynthesis,
        {
          totalAnalyzed: results.classificationResults?.items?.length || 0,
          dataSources: ['reddit'],
          subredditsSearched: results.scrapeResults?.subredditsSearched || [],
        }
      );
      results.snapshot = saveResult.localResult;
      reportUuid = saveResult.uuid;
      console.log('│  ✅ Synthesis saved');
    } catch (error) {
      console.error('│  ❌ Save error:', error.message);
      results.errors.push({ step: 'save', error: error.message });
    }
  } else {
    console.log('│  ⚠️  No synthesis data to save');
  }

  if (company && supabaseAdmin && results.classificationResults) {
    try {
      const itemsToStore = results.classificationResults.items.map(item => ({
        ...results.scrapeResults.mentions.find(m => m.sourceId === item.sourceId),
        classification: item,
      }));
      await insertFeedbackItems(tenantUuid, company.id, itemsToStore);
      console.log(`│  ✅ Stored ${itemsToStore.length} items to Supabase`);
    } catch (error) {
      console.error('│  ⚠️  Supabase storage error:', error.message);
    }
  }

  console.log('└─ Storage complete');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════════════════════╗
║                      Scout Complete                                                          ║
╠══════════════════════════════════════════════════════════════════════════════════════════════╣
║  Duration: ${(elapsed + 's').padEnd(49)}                                                     ║
║  Items Analyzed: ${(results.classificationResults?.items?.length || 0).toString().padEnd(43)}║
║  Errors: ${results.errors.length.toString().padEnd(51)}                                      ║
╚══════════════════════════════════════════════════════════════════════════════════════════════╝
`);

  if (results.strategicSynthesis) {
    console.log(formatSynthesisReport(results.strategicSynthesis, companyName));
  }

  console.log('\n┌─ JSON Output ────────────────────────────────────────────┐');
  console.log(JSON.stringify({
    metadata: {
      companyName,
      tenantId,
      reportUuid,
      reportUrl: reportUuid ? `http://localhost:5173/report/${reportUuid}` : null,
      legacyUrl: `http://localhost:5173/?company=${encodeURIComponent(companyName)}`,
      analyzedAt: new Date().toISOString(),
      totalItems: results.classificationResults?.items?.length || 0,
    },
    synthesis: results.strategicSynthesis,
    errors: results.errors,
  }, null, 2));

  results.reportUuid = reportUuid;
  return results;
}

async function main() {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.companyName) {
    console.error('Error: Company name is required\n');
    printHelp();
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error(`
╔═══════════════════════════════════════════════════════════════╗
║                    Configuration Error                        ║
╠═══════════════════════════════════════════════════════════════╣
║  Missing OPENAI_API_KEY environment variable                  ║
║                                                               ║
║  1. Copy .env.example to .env                                 ║
║  2. Add your OpenAI API key                                   ║
║  3. Run: npm run scout "CompanyName"                          ║
╚═══════════════════════════════════════════════════════════════╝
`);
    process.exit(1);
  }

  try {
    await scout(args.companyName, args.tenantId);
  } catch (error) {
    console.error('Scout failed:', error);
    process.exit(1);
  }
}

main();
