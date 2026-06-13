#!/usr/bin/env node
/**
 * Threader AI - Diagnostic Script
 * Tests the connection between scout.js and the frontend
 *
 * Usage: node scripts/diagnose.js [company_name]
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) { log(`✅ ${message}`, 'green'); }
function error(message) { log(`❌ ${message}`, 'red'); }
function warn(message) { log(`⚠️  ${message}`, 'yellow'); }
function info(message) { log(`ℹ️  ${message}`, 'blue'); }
function header(message) { log(`\n${'═'.repeat(60)}\n${message}\n${'═'.repeat(60)}`, 'cyan'); }

async function diagnose() {
  const companyName = process.argv[2] || 'TestCompany';

  header('THREADER AI - DIAGNOSTIC TOOL');
  log(`Testing pipeline for: ${companyName}\n`);

  let issues = [];
  let supabaseAdmin = null;

  // Step 1: Check Environment Variables
  header('Step 1: Environment Variables');

  const envVars = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  };

  for (const [key, value] of Object.entries(envVars)) {
    if (value) {
      success(`${key}: Set (${value.substring(0, 20)}...)`);
    } else {
      error(`${key}: NOT SET`);
      issues.push(`Missing ${key} in .env file`);
    }
  }

  // Step 2: Test Supabase Connection
  header('Step 2: Supabase Connection');

  if (envVars.SUPABASE_URL && envVars.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      supabaseAdmin = createClient(
        envVars.SUPABASE_URL,
        envVars.SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: { autoRefreshToken: false, persistSession: false },
        }
      );

      // Test connection with a simple query
      const { error: connError } = await supabaseAdmin
        .from('snapshots')
        .select('id')
        .limit(1);

      if (connError) {
        if (connError.code === '42P01') {
          error('Snapshots table does not exist!');
          issues.push('Snapshots table not created in Supabase');
          info('Run the SQL below in your Supabase dashboard to create it.');
        } else {
          error(`Connection error: ${connError.message}`);
          issues.push(`Supabase connection error: ${connError.message}`);
        }
      } else {
        success('Connected to Supabase successfully');
      }
    } catch (err) {
      error(`Failed to connect: ${err.message}`);
      issues.push(`Supabase connection failed: ${err.message}`);
    }
  } else {
    warn('Skipping Supabase test (credentials not set)');
  }

  // Step 3: Check for existing snapshots
  header('Step 3: Check Existing Snapshots');

  if (supabaseAdmin) {
    try {
      const { data: snapshots, error: snapError } = await supabaseAdmin
        .from('snapshots')
        .select('id, company_name, is_public, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (snapError) {
        error(`Query error: ${snapError.message}`);
      } else if (snapshots && snapshots.length > 0) {
        success(`Found ${snapshots.length} snapshot(s):`);
        snapshots.forEach(s => {
          log(`   - ${s.company_name} (public: ${s.is_public}) - ${s.created_at}`);
        });

        // Check if requested company exists
        const companySnapshot = snapshots.find(
          s => s.company_name.toLowerCase() === companyName.toLowerCase()
        );
        if (companySnapshot) {
          success(`Snapshot exists for "${companyName}"`);
        } else {
          warn(`No snapshot found for "${companyName}"`);
        }
      } else {
        warn('No snapshots found in database');
        issues.push('No snapshots exist yet - run npm run scout first');
      }
    } catch (err) {
      error(`Query failed: ${err.message}`);
    }
  }

  // Step 4: Test Insert (with cleanup)
  header('Step 4: Test Snapshot Insert');

  if (supabaseAdmin) {
    const testId = `test-${Date.now()}`;
    try {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('snapshots')
        .insert({
          tenant_id: 'diagnostic_test',
          company_name: testId,
          is_public: true,
          synthesis_data: { test: true, timestamp: new Date().toISOString() },
          metadata: { source: 'diagnostic_script' },
        })
        .select()
        .single();

      if (insertError) {
        error(`Insert failed: ${insertError.message}`);
        issues.push(`Cannot insert into snapshots table: ${insertError.message}`);
      } else {
        success(`Test insert successful (ID: ${inserted.id})`);

        // Clean up
        await supabaseAdmin.from('snapshots').delete().eq('id', inserted.id);
        success('Test record cleaned up');
      }
    } catch (err) {
      error(`Insert test failed: ${err.message}`);
    }
  }

  // Step 5: Check Frontend Config
  header('Step 5: Frontend Configuration');

  const frontendEnvPath = path.join(__dirname, '../frontend/.env');
  const frontendEnvLocalPath = path.join(__dirname, '../frontend/.env.local');

  if (fs.existsSync(frontendEnvPath) || fs.existsSync(frontendEnvLocalPath)) {
    success('Frontend .env file exists');

    // Read and check for VITE_SUPABASE_URL
    const envFile = fs.existsSync(frontendEnvLocalPath)
      ? fs.readFileSync(frontendEnvLocalPath, 'utf8')
      : fs.readFileSync(frontendEnvPath, 'utf8');

    if (envFile.includes('VITE_SUPABASE_URL')) {
      success('VITE_SUPABASE_URL is configured');
    } else {
      warn('VITE_SUPABASE_URL not found in frontend .env');
      issues.push('Frontend VITE_SUPABASE_URL not configured');
    }

    if (envFile.includes('VITE_SUPABASE_ANON_KEY')) {
      success('VITE_SUPABASE_ANON_KEY is configured');
    } else {
      warn('VITE_SUPABASE_ANON_KEY not found in frontend .env');
      issues.push('Frontend VITE_SUPABASE_ANON_KEY not configured');
    }
  } else {
    warn('Frontend .env file not found');
    issues.push('Frontend .env file missing');
  }

  // Summary
  header('DIAGNOSTIC SUMMARY');

  if (issues.length === 0) {
    success('All checks passed! Your pipeline should work correctly.');
    log(`\nTry running: npm run scout "${companyName}"`);
    log(`Then visit: http://localhost:5173/?company=${encodeURIComponent(companyName)}`);
  } else {
    error(`Found ${issues.length} issue(s):\n`);
    issues.forEach((issue, i) => {
      log(`   ${i + 1}. ${issue}`);
    });

    log('\n' + '─'.repeat(60));
    log('\nRECOMMENDED FIXES:\n');

    if (issues.some(i => i.includes('SUPABASE'))) {
      log('1. Create a Supabase project at https://supabase.com');
      log('2. Copy your credentials to .env:');
      log('   SUPABASE_URL=https://your-project.supabase.co');
      log('   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
      log('   SUPABASE_ANON_KEY=your-anon-key');
    }

    if (issues.some(i => i.includes('table'))) {
      log('\n3. Create the snapshots table - run this SQL in Supabase:');
      log(`
CREATE TABLE IF NOT EXISTS public.snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_id UUID,
  company_name TEXT NOT NULL,
  is_public BOOLEAN DEFAULT false,
  synthesis_data JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable public access for demo mode
ALTER TABLE public.snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for is_public=true" ON public.snapshots
  FOR SELECT USING (is_public = true);

CREATE POLICY "Allow service role full access" ON public.snapshots
  FOR ALL USING (auth.role() = 'service_role');

-- Index for fast company lookup
CREATE INDEX idx_snapshots_company_name ON public.snapshots(company_name);
CREATE INDEX idx_snapshots_public ON public.snapshots(is_public) WHERE is_public = true;
      `);
    }

    if (issues.some(i => i.includes('Frontend'))) {
      log('\n4. Configure frontend/.env:');
      log('   VITE_SUPABASE_URL=https://your-project.supabase.co');
      log('   VITE_SUPABASE_ANON_KEY=your-anon-key');
    }
  }
}

diagnose().catch(console.error);
