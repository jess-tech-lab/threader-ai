import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Moon,
  Sun,
  FileDown,
  ChevronDown,
  ChevronUp,
  Heart,
  Quote,
  Star,
  Target,
  CheckCircle2,
  Award,
  Loader2,
  Clock,
  AlertCircle
} from 'lucide-react';

// Custom Thread Logo Icon - weaving line through dots
function ThreadLogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Weaving thread through 4 dots */}
      <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="10" cy="6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="14" cy="18" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="20" cy="12" r="1.5" fill="currentColor" stroke="none" />
      {/* Weaving line */}
      <path d="M4 12 Q7 6, 10 6 Q12 6, 12 12 Q12 18, 14 18 Q17 18, 20 12" />
    </svg>
  );
}
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { MiniNav } from '@/components/dashboard/MiniNav';
import { FocusAreaCard } from '@/components/dashboard/FocusAreaCard';
import { AskThreaderButton } from '@/components/dashboard/AskThreaderButton';
import { AskThreaderPanel } from '@/components/dashboard/AskThreaderPanel';
import {
  generateFullReport,
  generateOnePager,
  downloadPDF,
} from '@/lib/reportGenerator';
import type { SynthesisReportV2 } from '@/types';

interface DemoModeProps {
  companyName: string;
  synthesis: SynthesisReportV2 | null;
}

interface DashboardV2Props {
  demoMode?: DemoModeProps;
}

/**
 * Empty State Component - Shown when no data is available
 */
function EmptyState({ companyName }: { companyName: string }) {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-muted/50 flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">
        No Data Available
      </h3>
      <p className="text-muted-foreground max-w-md mx-auto mb-6">
        There's no synthesis data for {companyName} yet. Run the scout command to generate a report.
      </p>
      <div className="bg-muted/30 border border-border rounded-lg p-4 max-w-xs mx-auto text-left">
        <p className="text-xs text-muted-foreground mb-2 font-medium">Run this command:</p>
        <code className="text-sm font-mono text-primary">
          npm run scout "{companyName}"
        </code>
      </div>
    </div>
  );
}

export function DashboardV2({ demoMode }: DashboardV2Props) {
  const [isDark, setIsDark] = useState(false);
  const [isNarrativeExpanded, setIsNarrativeExpanded] = useState(false);
  const [isAskThreaderOpen, setIsAskThreaderOpen] = useState(false);
  const [isExporting, setIsExporting] = useState<'full' | 'onepager' | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<import('@/types').FocusArea | null>(null);

  // Demo mode: company name comes from URL, synthesis comes from useDemoMode hook
  // Non-demo mode: defaults (for authenticated users)
  const companyName = demoMode?.companyName || 'Your Company';
  const synthesis = demoMode?.synthesis || null;
  const isDemoMode = !!demoMode;
  const reportType = 'Reddit Sentiment Report';
  const dataTimeframe = '48 hours';

  // Reset narrative expanded state when company changes
  useEffect(() => {
    setIsNarrativeExpanded(false);
  }, [companyName]);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  // Handle card click to open AI chat with feedback
  const handleCardClick = (focusArea: import('@/types').FocusArea) => {
    setSelectedFeedback(focusArea);
    setIsAskThreaderOpen(true);
  };

  // Clear selected feedback when closing
  const handleClearFeedback = () => {
    setSelectedFeedback(null);
  };

  const handleExportPDF = async (mode: 'full' | 'onepager') => {
    if (!synthesis) return;
    setIsExporting(mode);
    setIsExportMenuOpen(false);
    try {
      const reportData = {
        companyName,
        synthesis,
        generatedAt: new Date().toLocaleString(),
        timeWindow: dataTimeframe,
      };
      const blob = mode === 'full'
        ? await generateFullReport(reportData)
        : await generateOnePager(reportData);
      const suffix = mode === 'full' ? 'full-report' : 'executive-summary';
      const filename = `threader-${suffix}-${companyName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf`;
      downloadPDF(blob, filename);
    } finally {
      setIsExporting(null);
    }
  };

  // Smart suggestions for Ask Threader - dynamic based on actual data
  const smartSuggestions = synthesis ? [
    {
      label: `Why is ${synthesis.focusAreas[0]?.title || 'this'} the top issue?`,
      query: `Why is ${synthesis.focusAreas[0]?.title || 'this'} the top issue?`
    },
    {
      label: `What do users love most about ${companyName}?`,
      query: `What do users love most about ${companyName}?`
    },
    {
      label: 'Compare this report to the previous analysis',
      query: 'Compare this report to the previous analysis'
    },
    {
      label: 'What should we prioritize for Q1?',
      query: 'What should we prioritize for Q1?'
    },
  ] : [];

  // Generate simplified, action-oriented narrative
  const generateSimplifiedNarrative = () => {
    if (!synthesis) return { brief: '', full: '' };

    const topStrength = synthesis.brandStrengths.topLoves[0]?.feature || 'core features';
    const topIssue = synthesis.focusAreas[0]?.title || 'performance';
    const secondIssue = synthesis.focusAreas[1]?.title || 'user experience';
    const businessOutcome = 'higher retention and user satisfaction';

    const brief = `Users love ${companyName}'s ${topStrength}. The main opportunity: improve ${topIssue} and ${secondIssue} to unlock ${businessOutcome}.`;

    const full = `Users love ${companyName}'s ${topStrength}. The main opportunity: improve ${topIssue} and ${secondIssue} to unlock ${businessOutcome}.

Key actions: Focus engineering resources on ${topIssue.toLowerCase()} (affecting ${synthesis.focusAreas[0]?.frequency || 0} users). Meanwhile, ${secondIssue.toLowerCase()} remains a consistent request that could differentiate from competitors.

Brand strength is solid at ${synthesis.brandStrengths.overallScore}/10, driven by ${synthesis.brandStrengths.brandPersonality.join(', ').toLowerCase()} positioning.`;

    return { brief, full };
  };

  const narrative = generateSimplifiedNarrative();

  // Brand-centric headline
  const heroHeadline = `${companyName}: Growth Opportunities`;

  // Format last updated time
  const formatLastUpdated = () => {
    if (!synthesis) return '—';
    const date = new Date(synthesis.metadata.analysisDate);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // If no synthesis data is available, show empty state
  const hasData = synthesis !== null;

  return (
    <TooltipProvider>
      <div className={`min-h-screen bg-background ${isDark ? 'dark' : ''}`}>
        {/* Mini Navigation */}
        <MiniNav />

        {/* Header */}
        <header className="sticky top-0 z-40 glass border-b border-border/50">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Logo & Title */}
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <ThreadLogoIcon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-semibold">Threader</h1>
                    {isDemoMode && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded bg-primary/10 text-primary">
                        Demo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{companyName}</p>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2">
                {/* Export PDF Dropdown */}
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                    disabled={isExporting !== null || !hasData}
                    className="gap-2"
                  >
                    {isExporting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileDown className="w-4 h-4" />
                    )}
                    Export PDF
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>

                  {/* Dropdown Menu */}
                  <AnimatePresence>
                    {isExportMenuOpen && (
                      <>
                        {/* Backdrop */}
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setIsExportMenuOpen(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: -5, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -5, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg glass border border-border/50 shadow-lg overflow-hidden"
                        >
                          <button
                            onClick={() => handleExportPDF('full')}
                            className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border/30"
                          >
                            <div className="font-medium text-sm">Full Strategic Report</div>
                            <div className="text-xs text-muted-foreground mt-0.5">5-page detailed analysis</div>
                          </button>
                          <button
                            onClick={() => handleExportPDF('onepager')}
                            className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                          >
                            <div className="font-medium text-sm">Executive One-Pager</div>
                            <div className="text-xs text-muted-foreground mt-0.5">TL;DR summary</div>
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
                <Button variant="ghost" size="icon" onClick={toggleTheme}>
                  {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-6xl mx-auto px-6 py-8 xl:pl-48">
          {/* Show empty state if no data */}
          {!hasData ? (
            <EmptyState companyName={companyName} />
          ) : (
            <>
              {/* Overview Section */}
              <section id="overview" className="mb-12">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  {/* Hero Headline */}
                  <div className="mb-2">
                    <h2 className="hero-headline">{heroHeadline}</h2>
                  </div>

                  {/* Metadata Anchor */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6">
                    <span>{reportType}</span>
                    <span className="text-border">•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Last updated: {formatLastUpdated()}
                    </span>
                    <span className="text-border">•</span>
                    <span>Data from last {dataTimeframe}</span>
                  </div>

                  {/* Key Metrics Grid - FIRST (before narrative) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                    {[
                      { label: 'Total Analyzed', value: synthesis.metadata.totalAnalyzed, hasTooltip: false },
                      { label: 'High Signal', value: synthesis.metadata.highSignalCount, hasTooltip: false },
                      { label: 'Focus Areas', value: synthesis.focusAreas.length, hasTooltip: false },
                      { label: 'Brand Score', value: synthesis.brandStrengths.overallScore, hasTooltip: true },
                    ].map((stat, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + i * 0.05 }}
                      >
                        <GlassCard hover={false} animate={false} className="text-center py-4">
                          {stat.hasTooltip ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="cursor-help">
                                  <p className="text-2xl font-bold text-foreground">
                                    {stat.value}<span className="text-lg text-muted-foreground">/10</span>
                                  </p>
                                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="glass-panel p-4 max-w-xs">
                                <div className="space-y-3">
                                  <p className="font-semibold text-foreground">Brand Score Calculation</p>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Frequency weight</span>
                                      <span className="font-mono">× 0.4</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Sentiment weight</span>
                                      <span className="font-mono">× 0.3</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Velocity weight</span>
                                      <span className="font-mono">× 0.3</span>
                                    </div>
                                  </div>
                                  <div className="pt-2 border-t border-border">
                                    <p className="text-xs font-mono text-muted-foreground">
                                      Score = (F×0.4) + (S×0.3) + (V×0.3)
                                    </p>
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <>
                              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                              <p className="text-xs text-muted-foreground">{stat.label}</p>
                            </>
                          )}
                        </GlassCard>
                      </motion.div>
                    ))}
                  </div>

                  {/* Simplified Collapsible Narrative - AFTER metrics */}
                  <div className="max-w-3xl mt-8">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={isNarrativeExpanded ? 'full' : 'brief'}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <p className="narrative-text whitespace-pre-line">
                          {isNarrativeExpanded ? narrative.full : narrative.brief}
                        </p>
                      </motion.div>
                    </AnimatePresence>
                    <button
                      onClick={() => setIsNarrativeExpanded(!isNarrativeExpanded)}
                      className="flex items-center gap-1 mt-3 text-sm text-primary hover:text-primary/80 transition-colors"
                    >
                      {isNarrativeExpanded ? (
                        <>
                          <ChevronUp className="w-4 h-4" />
                          Show less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4" />
                          Show full narrative
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              </section>

              {/* Focus Areas Section */}
              <section id="focus-areas" className="mb-12">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-section-header">Focus Areas</h2>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-section-meta cursor-help">
                        Impact = (R×0.4) + (S×0.3) + (V×0.3)
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">
                      <div className="space-y-2">
                        <p className="font-medium">Impact Score Formula</p>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          <li>R = Reach (upvotes + comments)</li>
                          <li>S = Sentiment intensity</li>
                          <li>V = Velocity (engagement/time)</li>
                        </ul>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {synthesis.focusAreas.map((area, i) => (
                    <FocusAreaCard
                      key={area.id}
                      focusArea={area}
                      index={i}
                      onClick={handleCardClick}
                    />
                  ))}
                </div>
              </section>

              {/* What Users Love Section */}
              <section id="love" className="mb-12">
                <h2 className="text-section-header mb-6">What Users Love</h2>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20">
                    {/* Badge */}
                    <div className="absolute top-4 right-4">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/20 text-primary text-xs font-medium">
                        <Award className="w-3.5 h-3.5" />
                        Brand Strength
                      </div>
                    </div>

                    <div className="p-6">
                      {/* Header with Brand Score Tooltip */}
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 rounded-xl bg-primary/10">
                          <Heart className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-baseline gap-2 cursor-help">
                                <span className="text-display text-primary">
                                  {synthesis.brandStrengths.overallScore}
                                </span>
                                <span className="text-xl text-muted-foreground">/10</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="glass-panel p-4 max-w-xs">
                              <div className="space-y-3">
                                <p className="font-semibold text-foreground">Brand Score Breakdown</p>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Frequency</span>
                                    <span className="font-mono">× 0.4</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Sentiment</span>
                                    <span className="font-mono">× 0.3</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Velocity</span>
                                    <span className="font-mono">× 0.3</span>
                                  </div>
                                </div>
                                <p className="text-xs font-mono text-muted-foreground pt-2 border-t border-border">
                                  Score = (F×0.4) + (S×0.3) + (V×0.3)
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                          <p className="text-sm text-muted-foreground">
                            {synthesis.brandStrengths.brandPersonality.join(' • ')}
                          </p>
                        </div>
                      </div>

                      {/* Top Loves */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {synthesis.brandStrengths.topLoves.map((love, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 + i * 0.1 }}
                            className="glass-subtle rounded-xl p-4"
                          >
                            <div className="flex items-start gap-3">
                              <Quote className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-foreground mb-1">{love.feature}</p>
                                <p className="text-sm text-muted-foreground italic line-clamp-3">
                                  "{love.quote}"
                                </p>
                                <div className="flex items-center gap-1 mt-3">
                                  {Array.from({ length: 5 }).map((_, j) => (
                                    <Star
                                      key={j}
                                      className={`w-3.5 h-3.5 ${
                                        j < Math.round(love.shareability / 2)
                                          ? 'text-yellow-500 fill-yellow-500'
                                          : 'text-muted'
                                      }`}
                                    />
                                  ))}
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    {love.shareability}/10
                                  </span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </section>

              {/* Expectation Gaps Section */}
              <section id="gaps" className="mb-12">
                <h2 className="text-section-header mb-6">Expectation Gaps</h2>

                {synthesis.expectationGaps.length > 0 && (
                  <GlassCard hover={false} animate={false}>
                    <div className="divide-y divide-border/50">
                      {synthesis.expectationGaps.map((gap, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.1 }}
                          className="py-4 first:pt-0 last:pb-0"
                        >
                          <div className="flex items-start gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span
                                  className="px-2 py-0.5 rounded-full text-xs font-semibold"
                                  style={
                                    gap.gapSeverity === 'High'
                                      ? { backgroundColor: '#ffe8e8', color: '#d32f2f' }
                                      : gap.gapSeverity === 'Medium'
                                      ? { backgroundColor: '#fff3e0', color: '#e65100' }
                                      : { backgroundColor: '#f1f8e9', color: '#558b2f' }
                                  }
                                >
                                  {gap.gapSeverity}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Users Expect</p>
                                  <p className="text-sm text-foreground">{gap.expectation}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Reality</p>
                                  <p className="text-sm text-foreground">{gap.reality}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Suggested Fix</p>
                                  <p className="text-sm text-primary">{gap.suggestedFix}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </GlassCard>
                )}
              </section>

              {/* Next Moves (OKRs) Section */}
              <section id="next-moves" className="mb-12">
                <h2 className="text-section-header mb-6">Next Moves</h2>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <GlassCard hover={false} animate={false}>
                    <div className="flex items-center gap-2 mb-6">
                      <Target className="w-5 h-5 text-primary" />
                      <h3 className="text-title">AI-Generated OKRs</h3>
                    </div>

                    <div className="space-y-4">
                      {synthesis.suggestedOKRs.map((okr, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + i * 0.1 }}
                          className="p-4 rounded-xl bg-muted/30 border border-border/50"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                              {okr.timeframe}
                            </span>
                            <span className="text-sm font-medium text-muted-foreground">{okr.theme}</span>
                          </div>

                          <p className="font-semibold text-foreground mb-3">{okr.objective}</p>

                          <div className="space-y-2">
                            {okr.keyResults.map((kr, j) => (
                              <div key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                                <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                <span>{kr}</span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </GlassCard>
                </motion.div>
              </section>
            </>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-border/50 py-4">
          <div className="max-w-6xl mx-auto px-6 xl:pl-48 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Last updated: {synthesis ? new Date(synthesis.metadata.analysisDate).toLocaleString() : '—'}
            </span>
            <span>Threader AI</span>
          </div>
        </footer>

        {/* Ask Threader Floating Button - only show if we have data */}
        {hasData && (
          <AskThreaderButton
            isOpen={isAskThreaderOpen}
            onToggle={() => setIsAskThreaderOpen(!isAskThreaderOpen)}
          />
        )}

        {/* Ask Threader Side Panel */}
        <AskThreaderPanel
          isOpen={isAskThreaderOpen}
          onClose={() => setIsAskThreaderOpen(false)}
          suggestions={smartSuggestions}
          selectedFeedback={selectedFeedback}
          onClearFeedback={handleClearFeedback}
          synthesis={synthesis}
          companyName={companyName}
        />
      </div>
    </TooltipProvider>
  );
}
