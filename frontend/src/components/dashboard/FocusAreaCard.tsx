import { motion } from 'framer-motion';
import {
  Lightbulb,
  MousePointer2,
  Bug,
  Heart,
  Sparkles,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import type { FocusArea, FocusAreaCategory } from '@/types';

interface FocusAreaCardProps {
  focusArea: FocusArea;
  index: number;
  onClick?: (focusArea: FocusArea) => void;
}

const categoryConfig: Record<FocusAreaCategory, {
  color: string;
  bg: string;
  label: string;
  icon: React.ElementType;
}> = {
  feature_request: {
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/10',
    label: 'Feature',
    icon: Lightbulb,
  },
  usability_friction: {
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-500/10',
    label: 'Usability',
    icon: MousePointer2,
  },
  bug: {
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-500/10',
    label: 'Bug',
    icon: Bug,
  },
  praise: {
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-500/10',
    label: 'Praise',
    icon: Heart,
  },
};

const TrendBadge = ({ trend, delta }: { trend: string; delta: number }) => {
  if (trend === 'new') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-primary/15 text-primary">
        <Sparkles className="w-3 h-3" />
        NEW
      </span>
    );
  }
  if (trend === 'up') {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
        style={{ backgroundColor: '#ffebee', color: '#c2052f' }}
      >
        RISING +{Math.abs(delta)}
      </span>
    );
  }
  if (trend === 'down') {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
        style={{ backgroundColor: '#f1f8e9', color: '#558b2f' }}
      >
        DECLINING -{Math.abs(delta)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-muted text-muted-foreground">
      STABLE
    </span>
  );
};

function truncateQuote(quote: string, maxLength: number = 100): string {
  if (quote.length <= maxLength) return quote;
  return quote.slice(0, maxLength).trim() + '...';
}

// Strip leading/trailing quotes to avoid double-quoting
function cleanQuote(quote: string): string {
  return quote.replace(/^["'"]+|["'"]+$/g, '').trim();
}

export function FocusAreaCard({ focusArea, index, onClick }: FocusAreaCardProps) {
  const config = categoryConfig[focusArea.category] || categoryConfig.usability_friction;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="h-full"
    >
      <motion.div
        whileHover={{ scale: 1.02, y: -4 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="h-full cursor-pointer"
        onClick={() => onClick?.(focusArea)}
      >
        <GlassCard
          hover={false}
          animate={false}
          className="h-full flex flex-col p-4 hover:shadow-lg hover:shadow-primary/10 hover:border-primary/20 transition-all duration-300"
        >
          {/* Header Row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${config.bg}`}>
                <Icon className={`w-3.5 h-3.5 ${config.color}`} />
              </div>
              <span className={`text-xs font-medium ${config.color}`}>
                {config.label}
              </span>
            </div>
            <TrendBadge trend={focusArea.trend} delta={focusArea.trendDelta} />
          </div>

          {/* Title & Mentions */}
          <div className="mb-3">
            <h3 className="text-base font-semibold text-foreground mb-1 line-clamp-2">
              {focusArea.title}
            </h3>
            <span className="text-xs text-muted-foreground">
              {focusArea.frequency} mentions
            </span>
          </div>

          {/* Quote - Truncated, cleaned of extra quotes */}
          {focusArea.topQuote && (
            <blockquote className="text-sm text-muted-foreground italic border-l-2 border-border pl-3 mb-3 line-clamp-2">
              "{truncateQuote(cleanQuote(focusArea.topQuote))}"
            </blockquote>
          )}

          {/* Stakes - High contrast for accessibility */}
          <div
            className="text-xs px-3 py-2 rounded-lg mb-3"
            style={
              focusArea.stakes.type === 'risk'
                ? { backgroundColor: '#ffe8e8', color: '#d32f2f' }
                : focusArea.stakes.type === 'upside'
                ? { backgroundColor: '#e8f5e9', color: '#2e7d32' }
                : { backgroundColor: 'var(--color-muted)', color: 'var(--color-muted-foreground)' }
            }
          >
            <span className="line-clamp-2">{focusArea.stakes.message}</span>
          </div>

          {/* Footer: Segments */}
          <div className="mt-auto pt-2 border-t border-border/50">
            <div className="flex flex-wrap gap-1">
              {focusArea.affectedSegments.slice(0, 3).map((segment, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-muted/70 rounded text-xs text-muted-foreground"
                >
                  {segment}
                </span>
              ))}
              {focusArea.affectedSegments.length > 3 && (
                <span className="px-2 py-0.5 text-xs text-muted-foreground">
                  +{focusArea.affectedSegments.length - 3}
                </span>
              )}
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
