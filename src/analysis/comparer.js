export function compareSyntheses(current, previous) {
  if (!previous) {
    return { isFirstRun: true, changes: null, trends: null };
  }

  const changes = {
    newIssues: [],
    improvedIssues: [],
    worsenedIssues: [],
    resolvedIssues: [],
    stableIssues: [],
  };

  const currentAreas = new Map(current.focusAreas.map(fa => [`${fa.category}:${fa.title}`, fa]));
  const previousAreas = new Map(previous.focusAreas.map(fa => [`${fa.category}:${fa.title}`, fa]));

  for (const [key, currentArea] of currentAreas) {
    const previousArea = previousAreas.get(key);

    if (!previousArea) {
      changes.newIssues.push({
        ...currentArea,
        changeType: 'new',
        insight: `New ${currentArea.category.replace('_', ' ')} detected: "${currentArea.title}"`,
      });
    } else {
      const freqDelta = currentArea.frequency - previousArea.frequency;
      const impactDelta = (currentArea.impactScore || 0) - (previousArea.impactScore || 0);

      if (freqDelta < -2 || impactDelta < -1) {
        changes.improvedIssues.push({
          ...currentArea,
          changeType: 'improved',
          previousFrequency: previousArea.frequency,
          frequencyDelta: freqDelta,
          impactDelta,
          insight: `"${currentArea.title}" has improved: ${Math.abs(freqDelta)} fewer mentions`,
        });
      } else if (freqDelta > 2 || impactDelta > 1) {
        changes.worsenedIssues.push({
          ...currentArea,
          changeType: 'worsened',
          previousFrequency: previousArea.frequency,
          frequencyDelta: freqDelta,
          impactDelta,
          insight: `"${currentArea.title}" is growing: +${freqDelta} more mentions`,
        });
      } else {
        changes.stableIssues.push({
          ...currentArea,
          changeType: 'stable',
          previousFrequency: previousArea.frequency,
          frequencyDelta: freqDelta,
          impactDelta,
        });
      }
    }
  }

  for (const [key, previousArea] of previousAreas) {
    if (!currentAreas.has(key)) {
      changes.resolvedIssues.push({
        ...previousArea,
        changeType: 'resolved',
        insight: `"${previousArea.title}" no longer appearing in feedback`,
      });
    }
  }

  const trends = calculateOverallTrends(current, previous, changes);

  return {
    isFirstRun: false,
    comparedAt: new Date().toISOString(),
    previousSnapshotDate: previous.createdAt,
    changes,
    trends,
    summary: generateChangeSummary(changes, trends),
  };
}

function calculateOverallTrends(current, previous, changes) {
  const sentimentTrend = calculateSentimentTrend(current.sentiment, previous.sentiment);

  const volumeTrend = {
    current: current.metadata?.totalAnalyzed || 0,
    previous: previous.metadata?.totalAnalyzed || 0,
    delta: (current.metadata?.totalAnalyzed || 0) - (previous.metadata?.totalAnalyzed || 0),
    direction: calculateDirection(current.metadata?.totalAnalyzed || 0, previous.metadata?.totalAnalyzed || 0),
  };

  const resolutionRate = changes.resolvedIssues.length / (previous.focusAreas?.length || 1) * 100;
  const newIssueRate = changes.newIssues.length / (current.focusAreas?.length || 1) * 100;

  return {
    sentiment: sentimentTrend,
    volume: volumeTrend,
    resolutionRate: Math.round(resolutionRate),
    newIssueRate: Math.round(newIssueRate),
    overallHealth: calculateHealthScore(sentimentTrend, changes),
  };
}

function calculateSentimentTrend(current, previous) {
  if (!current || !previous) return null;

  const delta = (current.positive / 100) - (previous.positive / 100);

  return {
    current: { positive: current.positive, neutral: current.neutral, negative: current.negative, mood: current.mood },
    previous: { positive: previous.positive, neutral: previous.neutral, negative: previous.negative, mood: previous.mood },
    delta: Math.round(delta * 100),
    direction: delta > 0.02 ? 'improving' : delta < -0.02 ? 'declining' : 'stable',
    moodChange: current.mood !== previous.mood,
  };
}

function calculateDirection(current, previous) {
  const percentChange = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  if (percentChange > 10) return 'up';
  if (percentChange < -10) return 'down';
  return 'stable';
}

// Score starts at 50, adjusted by sentiment, resolved/worsened issues
function calculateHealthScore(sentimentTrend, changes) {
  let score = 50;

  if (sentimentTrend?.direction === 'improving') score += 15;
  if (sentimentTrend?.direction === 'declining') score -= 15;

  score += changes.resolvedIssues.length * 5;
  score += changes.improvedIssues.length * 3;
  score -= changes.worsenedIssues.length * 3;

  const criticalNew = changes.newIssues.filter(i => i.severityLabel === 'Critical').length;
  score -= criticalNew * 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function generateChangeSummary(changes, trends) {
  const parts = [];

  if (changes.newIssues.length > 0) {
    const critical = changes.newIssues.filter(i => i.severityLabel === 'Critical');
    parts.push(critical.length > 0
      ? `${critical.length} new critical issue(s) detected`
      : `${changes.newIssues.length} new issue(s) emerged`
    );
  }

  if (changes.improvedIssues.length > 0) parts.push(`${changes.improvedIssues.length} issue(s) showing improvement`);
  if (changes.worsenedIssues.length > 0) parts.push(`${changes.worsenedIssues.length} issue(s) getting worse`);
  if (changes.resolvedIssues.length > 0) parts.push(`${changes.resolvedIssues.length} issue(s) resolved`);

  if (trends?.sentiment?.direction === 'improving') parts.push('overall sentiment improving');
  else if (trends?.sentiment?.direction === 'declining') parts.push('overall sentiment declining');

  return parts.length > 0 ? parts.join(', ') + '.' : 'No significant changes detected.';
}

export function getWhatsNew(comparison) {
  if (comparison.isFirstRun) return { headline: 'First Analysis Run', items: [] };

  const items = [];

  for (const issue of comparison.changes.newIssues) {
    items.push({ type: 'new_issue', severity: issue.severityLabel || 'Medium', title: issue.title, category: issue.category, insight: issue.insight });
  }

  for (const issue of comparison.changes.improvedIssues) {
    if (Math.abs(issue.frequencyDelta) >= 3) {
      items.push({ type: 'improvement', title: issue.title, delta: issue.frequencyDelta, insight: issue.insight });
    }
  }

  for (const issue of comparison.changes.resolvedIssues) {
    items.push({ type: 'resolved', title: issue.title, insight: issue.insight });
  }

  return {
    headline: comparison.summary,
    items: items.slice(0, 10),
    healthScore: comparison.trends?.overallHealth || 50,
  };
}

export function getWhatsImproved(comparison) {
  if (comparison.isFirstRun) return [];

  return comparison.changes.improvedIssues.map(issue => ({
    title: issue.title,
    category: issue.category,
    previousFrequency: issue.previousFrequency,
    currentFrequency: issue.frequency,
    delta: issue.frequencyDelta,
    impactDelta: issue.impactDelta,
    insight: issue.insight,
  }));
}

export function attachTrendData(focusAreas, comparison) {
  if (comparison.isFirstRun) {
    return focusAreas.map(fa => ({ ...fa, trend: 'new', trendDelta: 0 }));
  }

  return focusAreas.map(fa => {
    const key = `${fa.category}:${fa.title}`;
    const improved = comparison.changes.improvedIssues.find(i => `${i.category}:${i.title}` === key);
    const worsened = comparison.changes.worsenedIssues.find(i => `${i.category}:${i.title}` === key);
    const newIssue = comparison.changes.newIssues.find(i => `${i.category}:${i.title}` === key);
    const stable = comparison.changes.stableIssues.find(i => `${i.category}:${i.title}` === key);

    if (newIssue) return { ...fa, trend: 'new', trendDelta: fa.frequency };
    if (improved) return { ...fa, trend: 'down', trendDelta: improved.frequencyDelta };
    if (worsened) return { ...fa, trend: 'up', trendDelta: worsened.frequencyDelta };
    if (stable) return { ...fa, trend: 'stable', trendDelta: stable.frequencyDelta };
    return { ...fa, trend: 'stable', trendDelta: 0 };
  });
}

export default { compareSyntheses, getWhatsNew, getWhatsImproved, attachTrendData };
