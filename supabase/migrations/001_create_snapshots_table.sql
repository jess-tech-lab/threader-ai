-- ============================================================================
-- Threader AI - Snapshots Table Migration
-- Creates a table for storing reports with secure UUID-based access
-- ============================================================================

-- Create the snapshots table
CREATE TABLE IF NOT EXISTS public.snapshots (
  -- Primary key: UUID for secure, unguessable URLs
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Company information
  company_name TEXT NOT NULL,

  -- The full synthesis report (JSON)
  report_data JSONB NOT NULL,

  -- Visibility flag for public demo mode
  is_public BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Optional: tenant for multi-tenancy (future use)
  tenant_id TEXT DEFAULT 'public',

  -- Optional: link to monitored_companies if exists
  company_id UUID REFERENCES public.monitored_companies(id) ON DELETE SET NULL
);

-- Add comments
COMMENT ON TABLE public.snapshots IS 'Stores Threader AI analysis reports with UUID-based secure access';
COMMENT ON COLUMN public.snapshots.id IS 'Unguessable UUID used in report URLs';
COMMENT ON COLUMN public.snapshots.report_data IS 'Full SynthesisReportV2 JSON data';
COMMENT ON COLUMN public.snapshots.is_public IS 'Whether this report is publicly accessible';

-- ============================================================================
-- Indexes for performance
-- ============================================================================

-- Index for UUID lookups (primary access pattern)
CREATE INDEX IF NOT EXISTS idx_snapshots_id ON public.snapshots(id);

-- Index for company name searches (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_snapshots_company_name ON public.snapshots(LOWER(company_name));

-- Index for public reports
CREATE INDEX IF NOT EXISTS idx_snapshots_is_public ON public.snapshots(is_public) WHERE is_public = true;

-- Index for recent reports (for listing)
CREATE INDEX IF NOT EXISTS idx_snapshots_created_at ON public.snapshots(created_at DESC);

-- Composite index for tenant + company lookups
CREATE INDEX IF NOT EXISTS idx_snapshots_tenant_company ON public.snapshots(tenant_id, company_name);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE public.snapshots ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read public reports
CREATE POLICY "public_read_access" ON public.snapshots
  FOR SELECT
  USING (is_public = true);

-- Policy: Authenticated users can read their tenant's reports
CREATE POLICY "tenant_read_access" ON public.snapshots
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND tenant_id = COALESCE(current_setting('app.tenant_id', true), 'public')
  );

-- Policy: Service role can do everything (for backend inserts)
CREATE POLICY "service_role_all" ON public.snapshots
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- Trigger for updated_at
-- ============================================================================

-- Create function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS snapshots_updated_at ON public.snapshots;
CREATE TRIGGER snapshots_updated_at
  BEFORE UPDATE ON public.snapshots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Helpful views
-- ============================================================================

-- View for recent public reports (useful for listing/discovery)
CREATE OR REPLACE VIEW public.recent_public_reports AS
SELECT
  id,
  company_name,
  created_at,
  (report_data->'metadata'->>'totalAnalyzed')::int as total_analyzed,
  (report_data->'sentiment'->>'mood') as sentiment_mood
FROM public.snapshots
WHERE is_public = true
ORDER BY created_at DESC
LIMIT 50;

COMMENT ON VIEW public.recent_public_reports IS 'Recent public reports for discovery/listing';
