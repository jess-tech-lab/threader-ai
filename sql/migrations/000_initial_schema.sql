-- Threader AI - Initial Schema Migration
-- Must run before 001_create_snapshots_table.sql (which references monitored_companies)

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monitored_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    search_terms TEXT[] DEFAULT '{}',
    subreddits TEXT[] DEFAULT '{}',
    twitter_handles TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feedback_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES monitored_companies(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL,
    source_id VARCHAR(255),
    source_url TEXT,
    title TEXT,
    body TEXT NOT NULL,
    author VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    original_created_at TIMESTAMPTZ,
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    category VARCHAR(50),
    user_segment VARCHAR(50),
    impact_type VARCHAR(50),
    urgency VARCHAR(100),
    sentiment VARCHAR(20),
    confidence_score DECIMAL(3,2),
    summary TEXT,
    key_points TEXT[],
    is_processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, source, source_id)
);

CREATE TABLE IF NOT EXISTS insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES monitored_companies(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    feedback_count INTEGER DEFAULT 0,
    affected_users_estimate VARCHAR(100),
    urgency_level VARCHAR(20),
    feedback_item_ids UUID[] DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'new',
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scrape_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES monitored_companies(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    items_found INTEGER DEFAULT 0,
    items_processed INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant ON user_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_monitored_companies_tenant ON monitored_companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_feedback_items_tenant ON feedback_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_feedback_items_company ON feedback_items(company_id);
CREATE INDEX IF NOT EXISTS idx_feedback_items_category ON feedback_items(category);
CREATE INDEX IF NOT EXISTS idx_feedback_items_source ON feedback_items(source);
CREATE INDEX IF NOT EXISTS idx_feedback_items_scraped_at ON feedback_items(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_tenant ON insights(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_tenant ON scrape_jobs(tenant_id);

-- ============================================================================
-- HELPER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT tenant_id
        FROM user_profiles
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitored_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own tenant" ON tenants
    FOR ALL USING (id = get_user_tenant_id());

CREATE POLICY "Users see own tenant profiles" ON user_profiles
    FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users update own profile" ON user_profiles
    FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users access own tenant companies" ON monitored_companies
    FOR ALL USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users see own tenant feedback" ON feedback_items
    FOR ALL USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users see own tenant insights" ON insights
    FOR ALL USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users see own tenant jobs" ON scrape_jobs
    FOR ALL USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Service role full access feedback" ON feedback_items
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access companies" ON monitored_companies
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access jobs" ON scrape_jobs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access insights" ON insights
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- TRIGGERS FOR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monitored_companies_updated_at BEFORE UPDATE ON monitored_companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feedback_items_updated_at BEFORE UPDATE ON feedback_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_insights_updated_at BEFORE UPDATE ON insights
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
