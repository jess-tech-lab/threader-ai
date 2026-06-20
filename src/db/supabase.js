import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.warn('[Supabase] SUPABASE_URL not configured');
}

// Public client - respects RLS policies
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Admin client - bypasses RLS, backend use only
export const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

// Resolves a tenant name (e.g. "system_admin") to its UUID, creating the row if needed
export async function getOrCreateTenant(name) {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured');

  const { data: existing } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('name', name)
    .single();

  if (existing) return existing.id;

  const { data, error } = await supabaseAdmin
    .from('tenants')
    .insert({ name })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function insertFeedbackItems(tenantId, companyId, feedbackItems) {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured');

  const records = feedbackItems.map(item => ({
    tenant_id: tenantId,
    company_id: companyId,
    source: item.source,
    source_id: item.sourceId,
    source_url: item.sourceUrl,
    title: item.title,
    body: item.body,
    author: item.author,
    metadata: {
      subreddit: item.subreddit,
      upvotes: item.upvotes,
      commentCount: item.commentCount,
      comments: item.comments,
    },
    original_created_at: item.createdAt,
    scraped_at: item.scrapedAt,
    category: item.analysis?.category,
    user_segment: item.analysis?.userSegment,
    impact_type: item.analysis?.impactType,
    urgency: item.analysis?.urgency,
    sentiment: item.analysis?.sentiment,
    is_processed: !!item.analysis?.category,
    processed_at: item.analysis?.category ? new Date().toISOString() : null,
  }));

  const { data, error } = await supabaseAdmin
    .from('feedback_items')
    .upsert(records, { onConflict: 'tenant_id,source,source_id', ignoreDuplicates: false })
    .select();

  if (error) {
    console.error('[Supabase] Error inserting feedback items:', error);
    throw error;
  }

  console.log(`[Supabase] Inserted/updated ${data.length} feedback items`);
  return data;
}

export async function getOrCreateCompany(tenantId, companyName) {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured');

  const { data: existing } = await supabaseAdmin
    .from('monitored_companies')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('name', companyName)
    .single();

  if (existing) return existing;

  const { data, error } = await supabaseAdmin
    .from('monitored_companies')
    .insert({ tenant_id: tenantId, name: companyName })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createScrapeJob(tenantId, companyId, source) {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured');

  const { data, error } = await supabaseAdmin
    .from('scrape_jobs')
    .insert({
      tenant_id: tenantId,
      company_id: companyId,
      source,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateScrapeJob(jobId, updates) {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured');

  const { error } = await supabaseAdmin.from('scrape_jobs').update(updates).eq('id', jobId);
  if (error) throw error;
}

export async function getUnprocessedFeedback(limit = 50) {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured');

  const { data, error } = await supabaseAdmin
    .from('feedback_items')
    .select('*')
    .eq('is_processed', false)
    .order('scraped_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function updateFeedbackClassification(itemId, classification) {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured');

  const { error } = await supabaseAdmin
    .from('feedback_items')
    .update({
      category: classification.category,
      user_segment: classification.userSegment,
      impact_type: classification.impactType,
      urgency: classification.urgency,
      sentiment: classification.sentiment,
      confidence_score: classification.confidenceScore,
      summary: classification.summary,
      key_points: classification.keyPoints,
      is_processed: true,
      processed_at: new Date().toISOString(),
    })
    .eq('id', itemId);

  if (error) throw error;
}
