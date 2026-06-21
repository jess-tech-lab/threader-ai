import Parser from 'rss-parser';
import dotenv from 'dotenv';
import { discoverSubreddits, quickDiscoverSubreddits } from '../analysis/subredditDiscovery.js';

dotenv.config();

// Reddit RSS endpoints are public — no API credentials required.
// Trade-off: upvotes and comment count are not included in RSS feeds,
// so those fields default to 0 in the normalized output.
const RSS_BASE = 'https://www.reddit.com';
const RATE_LIMIT_MS = 2000; // Reddit throttles rapid sequential RSS requests

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
  },
  timeout: 15000,
});

function extractPostId(url) {
  const m = url?.match(/\/comments\/([a-z0-9]+)\//);
  return m ? m[1] : url || '';
}

function extractSubreddit(url) {
  const m = url?.match(/\/r\/([^/]+)\//);
  return m ? m[1] : '';
}

function stripHtml(html) {
  return (html || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeRSSItem(item, companyName) {
  const subreddit = item.categories?.[0] || extractSubreddit(item.link) || '';

  return {
    source: 'reddit',
    sourceId: extractPostId(item.link),
    sourceUrl: item.link || '',
    title: item.title || null,
    body: item.contentSnippet || stripHtml(item.content) || '',
    author: item.creator || item['dc:creator'] || '[deleted]',
    subreddit,
    upvotes: 0,
    commentCount: 0,
    upvoteRatio: null,
    flair: null,
    createdAt: item.isoDate || item.pubDate || null,
    scrapedAt: new Date().toISOString(),
    companyName,
    analysis: {
      category: null,
      userSegment: null,
      impactType: null,
      urgency: null,
      sentiment: null,
    },
    comments: [],
  };
}

function isRelevantPost(post, searchTerms) {
  const content = `${post.title || ''} ${post.body || ''}`.toLowerCase();
  return searchTerms.some(term => content.includes(term.toLowerCase()));
}

export async function fetchRedditMentions(companyName, options = {}) {
  const { maxItems = 50 } = options;

  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);

  console.log(`[RedditScraper] Searching for "${companyName}" mentions via RSS...`);

  const url = `${RSS_BASE}/search.rss?q=${encodeURIComponent(companyName)}&sort=new&t=day&limit=${maxItems}`;
  const feed = await parser.parseURL(url);

  const cutoffMs = oneDayAgo.getTime();
  const filtered = (feed.items || []).filter(item => {
    const ts = item.isoDate ? new Date(item.isoDate).getTime() : 0;
    return ts >= cutoffMs;
  });

  console.log(`[RedditScraper] Found ${filtered.length} mentions in the last 24 hours`);
  return filtered.map(item => normalizeRSSItem(item, companyName));
}

export async function fetchSubredditPosts(subredditName, options = {}) {
  const { maxItems = 25 } = options;

  const url = `${RSS_BASE}/r/${subredditName}/new.rss?limit=${maxItems}`;
  const feed = await parser.parseURL(url);

  return (feed.items || []).map(item => normalizeRSSItem(item, subredditName));
}

export async function fetchAllRedditMentions(companyName, options = {}) {
  const { maxItems = 50 } = options;

  console.log(`[RedditScraper] Fetching Reddit data for "${companyName}"...`);
  const posts = await fetchRedditMentions(companyName, { maxItems });
  console.log(`[RedditScraper] Found ${posts.length} posts`);

  return { posts, comments: [], total: posts.length };
}

export async function smartScrape(companyName, options = {}) {
  const {
    maxItemsPerSubreddit = 50,
    useQuickDiscovery = false,
    companyContext = '',
    filterSecondary = true,
  } = options;

  let discovery;
  try {
    if (useQuickDiscovery || !process.env.OPENAI_API_KEY) {
      discovery = await quickDiscoverSubreddits(companyName);
    } else {
      discovery = await discoverSubreddits(companyName, companyContext);
    }
  } catch (error) {
    console.error('[SmartScrape] Discovery failed:', error.message);
    discovery = await quickDiscoverSubreddits(companyName);
  }

  if (discovery.subreddits.length === 0) {
    console.log('[Warning] No subreddits found — falling back to Reddit-wide search...');
    const mentions = await fetchRedditMentions(companyName, { maxItems: 50 });
    return {
      discovery: { subreddits: [], searchTerms: [companyName] },
      mentions,
      subredditResults: {},
    };
  }

  console.log(`\n[Step 2] Scraping ${discovery.subreddits.length} subreddits via RSS...`);

  const allMentions = [];
  const subredditResults = {};

  for (let i = 0; i < discovery.subreddits.length; i++) {
    const sub = discovery.subreddits[i];
    if (i > 0) await sleep(RATE_LIMIT_MS);
    console.log(`\n  Scraping r/${sub.name}...`);

    try {
      const posts = await fetchSubredditPosts(sub.name, { maxItems: maxItemsPerSubreddit });

      let relevantPosts = posts;
      if (filterSecondary && sub.relevance === 'secondary') {
        relevantPosts = posts.filter(post => isRelevantPost(post, discovery.searchTerms));
        console.log(`    Found ${posts.length} posts, ${relevantPosts.length} mention "${companyName}"`);
      } else {
        console.log(`    Found ${posts.length} recent posts`);
      }

      subredditResults[sub.name] = {
        total: posts.length,
        relevant: relevantPosts.length,
        relevance: sub.relevance,
      };

      allMentions.push(...relevantPosts.map(post => ({
        ...post,
        companyName,
        discoveredSubreddit: true,
        subredditRelevance: sub.relevance,
      })));
    } catch (error) {
      console.error(`    Error scraping r/${sub.name}:`, error.message);
      subredditResults[sub.name] = { total: 0, relevant: 0, error: error.message };
    }
  }

  console.log(`\n[Step 3] Total posts collected: ${allMentions.length}`);
  return { discovery, mentions: allMentions, subredditResults };
}

async function main() {
  const companyName = process.argv[2] || 'Notion';

  try {
    const result = await smartScrape(companyName);

    console.log('\nDiscovered Subreddits:');
    result.discovery.subreddits.forEach(sub => {
      const stats = result.subredditResults[sub.name] || {};
      if (sub.relevance === 'secondary') {
        console.log(`  r/${sub.name} [${sub.relevance}] - ${stats.relevant || 0}/${stats.total || 0} relevant posts`);
      } else {
        console.log(`  r/${sub.name} [${sub.relevance}] - ${stats.total || 0} posts`);
      }
    });

    console.log(`\nTotal Posts: ${result.mentions.length}`);
    result.mentions.slice(0, 5).forEach((post, i) => {
      console.log(`\n  [${i + 1}] r/${post.subreddit}`);
      console.log(`      ${post.title || '(No title)'}`);
    });
  } catch (error) {
    console.error('Scrape failed:', error.message);
    process.exit(1);
  }
}

// only run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
