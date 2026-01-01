import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ============================================================================
// THREADING ANIMATION COMPONENT - Network/Constellation Style
// ============================================================================

interface Point {
  id: number;
  x: number;
  y: number;
}

interface Connection {
  from: number;
  to: number;
}

/**
 * Generates random points spread across a larger area
 * Reduced padding for wider distribution (network/constellation feel)
 */
function generateRandomPoints(count: number): Point[] {
  const points: Point[] = [];
  const padding = 8; // % from edges (smaller padding = wider spread)

  for (let i = 0; i < count; i++) {
    points.push({
      id: i,
      x: padding + Math.random() * (100 - 2 * padding),
      y: padding + Math.random() * (100 - 2 * padding),
    });
  }

  return points;
}

/**
 * Creates network connections between nearby points
 * Each point connects to 1-2 nearby points
 */
function generateConnections(points: Point[]): Connection[] {
  const connections: Connection[] = [];
  const maxDistance = 65; // Larger distance to connect spread-out dots

  for (let i = 0; i < points.length; i++) {
    // Calculate distances to all other points
    const distances: { index: number; dist: number }[] = [];

    for (let j = 0; j < points.length; j++) {
      if (i !== j) {
        const dx = points[i].x - points[j].x;
        const dy = points[i].y - points[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDistance) {
          distances.push({ index: j, dist });
        }
      }
    }

    // Sort by distance and connect to 1-2 nearest
    distances.sort((a, b) => a.dist - b.dist);
    const connectCount = Math.min(2, distances.length);

    for (let k = 0; k < connectCount; k++) {
      const targetIndex = distances[k].index;
      // Avoid duplicate connections
      const exists = connections.some(
        c => (c.from === i && c.to === targetIndex) ||
             (c.from === targetIndex && c.to === i)
      );
      if (!exists) {
        connections.push({ from: i, to: targetIndex });
      }
    }
  }

  return connections;
}

/**
 * Threading Animation - Network/Constellation with straight lines
 * Brand: Teal/cyan color palette
 */
function ThreadingAnimation() {
  const [cycle, setCycle] = useState(0);
  const [points, setPoints] = useState<Point[]>(() => generateRandomPoints(6));
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Generate connections when points change
  useEffect(() => {
    if (!isTransitioning) {
      setConnections(generateConnections(points));
    }
  }, [points, isTransitioning]);

  // Generate new random points for next cycle
  const regeneratePoints = useCallback(() => {
    setIsTransitioning(true);

    // Wait for fade out, then generate new points
    setTimeout(() => {
      const count = 5 + Math.floor(Math.random() * 3); // 5-7 dots
      const newPoints = generateRandomPoints(count);
      setPoints(newPoints);
      setCycle(c => c + 1);
      setIsTransitioning(false);
    }, 800);
  }, []);

  // Cycle through animations - slower for premium feel
  useEffect(() => {
    const interval = setInterval(regeneratePoints, 10000); // 10 second cycles for calmer feel
    return () => clearInterval(interval);
  }, [regeneratePoints]);

  return (
    <div className="threading-container">
      <svg
        viewBox="0 0 100 100"
        className="threading-svg"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Definitions */}
        <defs>
          <linearGradient id="threadGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(20, 184, 166, 0.9)" />
            <stop offset="100%" stopColor="rgba(6, 182, 212, 0.7)" />
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Network lines connecting dots */}
        {connections.map((conn, index) => {
          const from = points[conn.from];
          const to = points[conn.to];
          if (!from || !to) return null;

          return (
            <motion.line
              key={`line-${cycle}-${index}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="rgba(20, 184, 166, 0.5)"
              strokeWidth="0.5"
              strokeLinecap="round"
              filter="url(#glow)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: isTransitioning ? 0 : 1,
                opacity: isTransitioning ? 0 : 0.6
              }}
              transition={{
                pathLength: { duration: 2.5, delay: index * 0.2, ease: "easeOut" },
                opacity: { duration: 0.8, delay: index * 0.2 }
              }}
            />
          );
        })}

        {/* The dots/nodes */}
        {points.map((point, index) => (
          <motion.circle
            key={`dot-${cycle}-${point.id}`}
            cx={point.x}
            cy={point.y}
            r="1.8"
            fill="rgba(20, 184, 166, 1)"
            filter="url(#glow)"
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: isTransitioning ? 0 : 1,
              opacity: isTransitioning ? 0 : 1
            }}
            transition={{
              delay: index * 0.15,
              duration: 0.8,
              ease: "backOut"
            }}
          />
        ))}

        {/* Subtle pulsing rings on dots */}
        {points.map((point, index) => (
          <motion.circle
            key={`ring-${cycle}-${point.id}`}
            cx={point.x}
            cy={point.y}
            r="1.8"
            fill="none"
            stroke="rgba(20, 184, 166, 0.3)"
            strokeWidth="0.4"
            initial={{ scale: 1, opacity: 0 }}
            animate={{
              scale: isTransitioning ? 1 : [1, 3, 1],
              opacity: isTransitioning ? 0 : [0.4, 0, 0.4]
            }}
            transition={{
              delay: index * 0.2 + 1,
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        ))}
      </svg>

      <style>{`
        .threading-container {
          width: 420px;
          height: 260px;
          position: relative;
        }

        .threading-svg {
          width: 100%;
          height: 100%;
        }
      `}</style>
    </div>
  );
}

// Pipeline stages for progress tracking
export type PipelineStage = 'connecting' | 'discovery' | 'scraping' | 'analyzing' | 'synthesizing' | 'complete' | 'polling';

// Cycling tips based on company name
const generateTips = (companyName: string) => [
  `Scouting subreddits for ${companyName}...`,
  `Collecting user feedback...`,
  `Analyzing sentiment patterns...`,
  `Identifying growth opportunities...`,
  `Synthesizing strategic insights...`,
  `Building your report...`,
];

interface ImmersiveLoaderProps {
  companyName: string;
  stage?: PipelineStage;
  pollCount?: number;
  maxPolls?: number;
  isPolling?: boolean;
}

/**
 * Minimalist Apple-like Loading Screen
 * Features: Iridescent gradient background, centered content, sleek progress bar
 */
export function ImmersiveLoader({
  companyName,
  stage = 'connecting',
  pollCount = 0,
  maxPolls = 20,
  isPolling = false,
}: ImmersiveLoaderProps) {
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [animatedProgress, setAnimatedProgress] = useState(5);
  const [simulatedProgress, setSimulatedProgress] = useState(0);
  const tips = generateTips(companyName);

  // Cycle through tips every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % tips.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [tips.length]);

  // Simulate progress when not polling (initial loading state)
  useEffect(() => {
    if (!isPolling) {
      const interval = setInterval(() => {
        setSimulatedProgress((prev) => {
          // Slowly increase to 85%, never reaching 100% until actual completion
          if (prev >= 85) return prev;
          // Slow down as we get closer to 85%
          const increment = Math.max(0.5, (85 - prev) / 30);
          return Math.min(85, prev + increment);
        });
      }, 150);
      return () => clearInterval(interval);
    }
  }, [isPolling]);

  // Calculate progress based on stage or poll count
  const getProgress = () => {
    if (isPolling) {
      const pollProgress = Math.min(pollCount / maxPolls, 1);
      return 15 + pollProgress * 80;
    }

    // For non-polling states, use simulated progress
    if (stage === 'connecting' || stage === 'polling') {
      return Math.max(5, simulatedProgress);
    }

    const stages: PipelineStage[] = ['connecting', 'discovery', 'scraping', 'analyzing', 'synthesizing', 'complete'];
    const stageIndex = stages.indexOf(stage);
    if (stageIndex === -1) return simulatedProgress;
    return Math.max(simulatedProgress, ((stageIndex + 1) / stages.length) * 100);
  };

  // Smooth progress animation
  useEffect(() => {
    const target = getProgress();
    const interval = setInterval(() => {
      setAnimatedProgress((prev) => {
        const diff = target - prev;
        if (Math.abs(diff) < 0.3) {
          return target;
        }
        return prev + diff * 0.15;
      });
    }, 30);
    return () => clearInterval(interval);
  }, [stage, pollCount, isPolling, simulatedProgress]);

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden">
      {/* Multi-layer organic gradient background */}
      <div className="absolute inset-0 bg-white" />

      {/* Layer 1: Large soft pink bloom - slow drift */}
      <div className="absolute inset-0 gradient-blob gradient-blob-1" />

      {/* Layer 2: Purple/blue bloom - medium drift */}
      <div className="absolute inset-0 gradient-blob gradient-blob-2" />

      {/* Layer 3: Mint/green bloom - different rhythm */}
      <div className="absolute inset-0 gradient-blob gradient-blob-3" />

      {/* Layer 4: Warm yellow/peach accent - subtle pulse */}
      <div className="absolute inset-0 gradient-blob gradient-blob-4" />

      {/* Subtle grain overlay for premium feel */}
      <div className="absolute inset-0 opacity-[0.02] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIzMDAiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iMSIvPjwvc3ZnPg==')]" />

      {/* Centered Content */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center px-6 max-w-md w-full"
      >
        {/* Threading Animation */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mb-6"
        >
          <ThreadingAnimation />
        </motion.div>

        {/* Company Name */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-2xl font-semibold text-gray-900 mb-2 text-center"
        >
          {companyName}
        </motion.h1>

        {/* Progress Bar Container */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="w-full max-w-xs mb-6 mt-4"
        >
          {/* Progress Track */}
          <div className="h-1 bg-gray-900/10 rounded-full overflow-hidden">
            {/* Progress Fill */}
            <motion.div
              className="h-full bg-gray-900/70 rounded-full"
              style={{ width: `${animatedProgress}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>

          {/* Progress Percentage */}
          <div className="flex justify-end mt-2">
            <span className="text-xs font-medium text-gray-500 tabular-nums">
              {Math.round(animatedProgress)}%
            </span>
          </div>
        </motion.div>

        {/* Dynamic Tip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="h-6 flex items-center justify-center"
        >
          <AnimatePresence mode="wait">
            <motion.p
              key={currentTipIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="text-sm text-gray-500 text-center"
            >
              {tips[currentTipIndex]}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        {/* Polling indicator (subtle) */}
        {isPolling && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 flex items-center gap-2 text-xs text-gray-400"
          >
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Checking for results...</span>
          </motion.div>
        )}
      </motion.div>

      {/* CSS for organic multi-layer gradient animation */}
      <style>{`
        .gradient-blob {
          position: absolute;
          inset: 0;
          opacity: 0.7;
          filter: blur(80px);
          will-change: transform, opacity;
        }

        /* Layer 1: Soft pink - large, breathing movement */
        .gradient-blob-1 {
          background: radial-gradient(
            ellipse 80% 60% at 20% 30%,
            rgba(253, 242, 248, 0.9) 0%,
            rgba(252, 231, 243, 0.6) 40%,
            transparent 70%
          );
          animation: drift1 8s ease-in-out infinite, breathe1 4s ease-in-out infinite;
        }

        /* Layer 2: Purple/violet - drifts opposite direction */
        .gradient-blob-2 {
          background: radial-gradient(
            ellipse 70% 80% at 80% 20%,
            rgba(237, 233, 254, 0.8) 0%,
            rgba(221, 214, 254, 0.5) 45%,
            transparent 70%
          );
          animation: drift2 10s ease-in-out infinite, breathe2 5s ease-in-out infinite;
        }

        /* Layer 3: Mint/teal - bottom area, rotation feel */
        .gradient-blob-3 {
          background: radial-gradient(
            ellipse 90% 50% at 50% 90%,
            rgba(209, 250, 229, 0.7) 0%,
            rgba(167, 243, 208, 0.4) 50%,
            transparent 70%
          );
          animation: drift3 7s ease-in-out infinite, breathe3 4.5s ease-in-out infinite;
        }

        /* Layer 4: Warm peach/yellow - accent that fades in/out */
        .gradient-blob-4 {
          background: radial-gradient(
            ellipse 50% 50% at 70% 60%,
            rgba(254, 243, 199, 0.6) 0%,
            rgba(254, 215, 170, 0.3) 50%,
            transparent 70%
          );
          animation: drift4 9s ease-in-out infinite, pulse4 3s ease-in-out infinite;
        }

        /* Drift animations - each blob moves in its own organic path */
        @keyframes drift1 {
          0%, 100% { transform: translate(0%, 0%) scale(1); }
          25% { transform: translate(8%, 15%) scale(1.08); }
          50% { transform: translate(-8%, 8%) scale(0.92); }
          75% { transform: translate(12%, -8%) scale(1.05); }
        }

        @keyframes drift2 {
          0%, 100% { transform: translate(0%, 0%) scale(1); }
          33% { transform: translate(-15%, 12%) scale(1.12); }
          66% { transform: translate(8%, -15%) scale(0.88); }
        }

        @keyframes drift3 {
          0%, 100% { transform: translate(0%, 0%) rotate(0deg); }
          50% { transform: translate(15%, -8%) rotate(5deg); }
        }

        @keyframes drift4 {
          0%, 100% { transform: translate(0%, 0%); }
          30% { transform: translate(-20%, 15%); }
          60% { transform: translate(15%, -12%); }
        }

        /* Breathing animations - opacity pulses */
        @keyframes breathe1 {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 0.4; }
        }

        @keyframes breathe2 {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; }
        }

        @keyframes breathe3 {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }

        @keyframes pulse4 {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }

      `}</style>
    </div>
  );
}

interface StillProcessingProps {
  companyName: string;
  elapsedSeconds: number;
  onRetry: () => void;
  onManualCheck: () => void;
}

/**
 * Minimalist "Still Processing" state
 */
export function StillProcessing({
  companyName,
  elapsedSeconds,
  onRetry,
  onManualCheck,
}: StillProcessingProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden">
      {/* Multi-layer organic gradient background */}
      <div className="absolute inset-0 bg-white" />
      <div className="absolute inset-0 gradient-blob gradient-blob-1" />
      <div className="absolute inset-0 gradient-blob gradient-blob-2" />
      <div className="absolute inset-0 gradient-blob gradient-blob-3" />
      <div className="absolute inset-0 gradient-blob gradient-blob-4" />

      {/* Grain overlay */}
      <div className="absolute inset-0 opacity-[0.02] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIzMDAiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iMSIvPjwvc3ZnPg==')]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center px-6 max-w-sm w-full text-center"
      >
        {/* Amber indicator */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-6"
        >
          <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
        </motion.div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Taking longer than expected
        </h2>

        {/* Subtitle */}
        <p className="text-sm text-gray-500 mb-2">
          Analysis for <span className="font-medium text-gray-700">{companyName}</span> is still running
        </p>

        {/* Timer */}
        <p className="text-xs text-gray-400 mb-8 tabular-nums">
          {elapsedSeconds}s elapsed
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={onManualCheck}
            variant="default"
            size="sm"
            className="bg-gray-900 hover:bg-gray-800 text-white rounded-full px-5"
          >
            Check Again
          </Button>
          <Button
            onClick={onRetry}
            variant="ghost"
            size="sm"
            className="text-gray-600 hover:text-gray-900 rounded-full px-5"
          >
            Restart
          </Button>
        </div>
      </motion.div>

      {/* Shared gradient styles */}
      <style>{`
        .gradient-blob { position: absolute; inset: 0; opacity: 0.7; filter: blur(80px); will-change: transform, opacity; }
        .gradient-blob-1 { background: radial-gradient(ellipse 80% 60% at 20% 30%, rgba(253, 242, 248, 0.9) 0%, rgba(252, 231, 243, 0.6) 40%, transparent 70%); animation: drift1 8s ease-in-out infinite, breathe1 4s ease-in-out infinite; }
        .gradient-blob-2 { background: radial-gradient(ellipse 70% 80% at 80% 20%, rgba(237, 233, 254, 0.8) 0%, rgba(221, 214, 254, 0.5) 45%, transparent 70%); animation: drift2 10s ease-in-out infinite, breathe2 5s ease-in-out infinite; }
        .gradient-blob-3 { background: radial-gradient(ellipse 90% 50% at 50% 90%, rgba(209, 250, 229, 0.7) 0%, rgba(167, 243, 208, 0.4) 50%, transparent 70%); animation: drift3 7s ease-in-out infinite, breathe3 4.5s ease-in-out infinite; }
        .gradient-blob-4 { background: radial-gradient(ellipse 50% 50% at 70% 60%, rgba(254, 243, 199, 0.6) 0%, rgba(254, 215, 170, 0.3) 50%, transparent 70%); animation: drift4 9s ease-in-out infinite, pulse4 3s ease-in-out infinite; }
        @keyframes drift1 { 0%, 100% { transform: translate(0%, 0%) scale(1); } 25% { transform: translate(8%, 15%) scale(1.08); } 50% { transform: translate(-8%, 8%) scale(0.92); } 75% { transform: translate(12%, -8%) scale(1.05); } }
        @keyframes drift2 { 0%, 100% { transform: translate(0%, 0%) scale(1); } 33% { transform: translate(-15%, 12%) scale(1.12); } 66% { transform: translate(8%, -15%) scale(0.88); } }
        @keyframes drift3 { 0%, 100% { transform: translate(0%, 0%) rotate(0deg); } 50% { transform: translate(15%, -8%) rotate(5deg); } }
        @keyframes drift4 { 0%, 100% { transform: translate(0%, 0%); } 30% { transform: translate(-20%, 15%); } 60% { transform: translate(15%, -12%); } }
        @keyframes breathe1 { 0%, 100% { opacity: 0.7; } 50% { opacity: 0.4; } }
        @keyframes breathe2 { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.8; } }
        @keyframes breathe3 { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }
        @keyframes pulse4 { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
      `}</style>
    </div>
  );
}

interface NoDataFoundProps {
  companyName: string;
  onRetry: () => void;
  onStartPolling: () => void;
}

/**
 * Minimalist "No Data Found" state
 */
export function NoDataFound({
  companyName,
  onRetry,
  onStartPolling,
}: NoDataFoundProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden">
      {/* Multi-layer organic gradient background */}
      <div className="absolute inset-0 bg-white" />
      <div className="absolute inset-0 gradient-blob gradient-blob-1" />
      <div className="absolute inset-0 gradient-blob gradient-blob-2" />
      <div className="absolute inset-0 gradient-blob gradient-blob-3" />
      <div className="absolute inset-0 gradient-blob gradient-blob-4" />

      {/* Grain overlay */}
      <div className="absolute inset-0 opacity-[0.02] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIzMDAiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iMSIvPjwvc3ZnPg==')]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center px-6 max-w-sm w-full text-center"
      >
        {/* Empty state indicator */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 rounded-full bg-gray-900/5 flex items-center justify-center mb-6"
        >
          <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-400" />
        </motion.div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          No report found
        </h2>

        {/* Subtitle */}
        <p className="text-sm text-gray-500 mb-6">
          Generate a report for <span className="font-medium text-gray-700">{companyName}</span>
        </p>

        {/* Command hint */}
        <div className="bg-gray-900/5 rounded-xl px-4 py-3 mb-8 w-full">
          <code className="text-sm font-mono text-gray-700">
            npm run scout "{companyName}"
          </code>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={onStartPolling}
            variant="default"
            size="sm"
            className="bg-gray-900 hover:bg-gray-800 text-white rounded-full px-5"
          >
            Wait for Report
          </Button>
          <Button
            onClick={onRetry}
            variant="ghost"
            size="sm"
            className="text-gray-600 hover:text-gray-900 rounded-full px-5"
          >
            Try Again
          </Button>
        </div>

        {/* Hint */}
        <p className="text-xs text-gray-400 mt-6">
          "Wait for Report" checks every 3 seconds
        </p>
      </motion.div>

      {/* Shared gradient styles */}
      <style>{`
        .gradient-blob { position: absolute; inset: 0; opacity: 0.7; filter: blur(80px); will-change: transform, opacity; }
        .gradient-blob-1 { background: radial-gradient(ellipse 80% 60% at 20% 30%, rgba(253, 242, 248, 0.9) 0%, rgba(252, 231, 243, 0.6) 40%, transparent 70%); animation: drift1 8s ease-in-out infinite, breathe1 4s ease-in-out infinite; }
        .gradient-blob-2 { background: radial-gradient(ellipse 70% 80% at 80% 20%, rgba(237, 233, 254, 0.8) 0%, rgba(221, 214, 254, 0.5) 45%, transparent 70%); animation: drift2 10s ease-in-out infinite, breathe2 5s ease-in-out infinite; }
        .gradient-blob-3 { background: radial-gradient(ellipse 90% 50% at 50% 90%, rgba(209, 250, 229, 0.7) 0%, rgba(167, 243, 208, 0.4) 50%, transparent 70%); animation: drift3 7s ease-in-out infinite, breathe3 4.5s ease-in-out infinite; }
        .gradient-blob-4 { background: radial-gradient(ellipse 50% 50% at 70% 60%, rgba(254, 243, 199, 0.6) 0%, rgba(254, 215, 170, 0.3) 50%, transparent 70%); animation: drift4 9s ease-in-out infinite, pulse4 3s ease-in-out infinite; }
        @keyframes drift1 { 0%, 100% { transform: translate(0%, 0%) scale(1); } 25% { transform: translate(8%, 15%) scale(1.08); } 50% { transform: translate(-8%, 8%) scale(0.92); } 75% { transform: translate(12%, -8%) scale(1.05); } }
        @keyframes drift2 { 0%, 100% { transform: translate(0%, 0%) scale(1); } 33% { transform: translate(-15%, 12%) scale(1.12); } 66% { transform: translate(8%, -15%) scale(0.88); } }
        @keyframes drift3 { 0%, 100% { transform: translate(0%, 0%) rotate(0deg); } 50% { transform: translate(15%, -8%) rotate(5deg); } }
        @keyframes drift4 { 0%, 100% { transform: translate(0%, 0%); } 30% { transform: translate(-20%, 15%); } 60% { transform: translate(15%, -12%); } }
        @keyframes breathe1 { 0%, 100% { opacity: 0.7; } 50% { opacity: 0.4; } }
        @keyframes breathe2 { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.8; } }
        @keyframes breathe3 { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }
        @keyframes pulse4 { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
      `}</style>
    </div>
  );
}
