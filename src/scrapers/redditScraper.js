/**
 * Threader AI - Reddit Scraper
 * Fetches recent mentions of a company from Reddit using Reddit's public JSON API
 * Uses LLM to discover relevant subreddits first, then searches within them
 * This is free and doesn't require any paid services (except OpenAI for discovery)
 */

import dotenv from 'dotenv';
import { discoverSubreddits, quickDiscoverSubreddits } from '../analysis/subredditDiscovery.js';

dotenv.config();

// User agent - use a browser-like UA to avoid blocks
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Rate limiting: Reddit allows ~60 requests per minute for unauthenticated requests
const RATE_LIMIT_DELAY = 2000; // 2 seconds between requests to be safe

/**
 * Sleep helper
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Make a rate-limited request to Reddit's JSON API
 * @param {string} url - The Reddit URL to fetch
 * @param {number} retries - Number of retry attempts
 * @returns {Promise<Object>} JSON response
 */
async function fetchRedditJson(url, retries = 3) {
  // Ensure URL ends with .json
  const jsonUrl = url.includes('.json') ? url : `${url}.json`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Add a small random delay to look more human
      await sleep(Math.random() * 1000 + 500);

      const response = await fetch(jsonUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Cache-Control': 'max-age=0',
        },
      });

      if (response.status === 429) {
        // Rate limited - wait and retry
        console.log(`[RedditScraper] Rate limited, waiting 30s before retry ${attempt}/${retries}...`);
        await sleep(30000);
        continue;
      }

      if (response.status === 403) {
        // Blocked - wait longer and retry with different approach
        console.log(`[RedditScraper] Blocked (403), waiting 10s before retry ${attempt}/${retries}...`);
        await sleep(10000);
        continue;
      }

      if (!response.ok) {
        throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      console.log(`[RedditScraper] Request failed, retrying... (${attempt}/${retries})`);
      await sleep(5000);
    }
  }
}

/**
 * Fetch Reddit mentions for a company within the last 24 hours
 * @param {string} companyName - The company name to search for
 * @param {Object} options - Optional configuration
 * @param {number} options.maxItems - Maximum number of items to fetch (default: 100)
 * @param {string[]} options.subreddits - Specific subreddits to search (optional)
 * @returns {Promise<Array>} Array of Reddit posts/comments mentioning the company
 */
export async function fetchRedditMentions(companyName, options = {}) {
  const { maxItems = 100, subreddits = [] } = options;

  // Calculate timestamp for 24 hours ago
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);
  const oneDayAgoTimestamp = Math.floor(oneDayAgo.getTime() / 1000);

  console.log(`[RedditScraper] Searching for "${companyName}" mentions...`);
  console.log(`[RedditScraper] Timeframe: Last 24 hours (since ${oneDayAgo.toISOString()})`);
  console.log(`[RedditScraper] Using Reddit's free public JSON API`);

  const allPosts = [];
  let after = null;
  let fetchCount = 0;
  const maxFetches = Math.ceil(maxItems / 25); // Reddit returns max 25 per request

  try {
    // Build search URL - Reddit search with time filter
    const baseUrl = subreddits.length > 0
      ? `https://www.reddit.com/r/${subreddits.join('+')}/search.json`
      : 'https://www.reddit.com/search.json';

    while (fetchCount < maxFetches && allPosts.length < maxItems) {
      const params = new URLSearchParams({
        q: companyName,
        sort: 'new',
        t: 'day', // Time filter: last 24 hours
        limit: '25',
        restrict_sr: subreddits.length > 0 ? '1' : '0',
      });

      if (after) {
        params.set('after', after);
      }

      const url = `${baseUrl}?${params.toString()}`;
      console.log(`[RedditScraper] Fetching page ${fetchCount + 1}...`);

      const data = await fetchRedditJson(url);

      if (!data.data || !data.data.children || data.data.children.length === 0) {
        break;
      }

      // Filter and add posts from last 24 hours
      for (const child of data.data.children) {
        const post = child.data;
        if (post.created_utc >= oneDayAgoTimestamp) {
          allPosts.push(post);
        }
      }

      after = data.data.after;
      fetchCount++;

      if (!after) break; // No more pages

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    }

    console.log(`[RedditScraper] Found ${allPosts.length} mentions in the last 24 hours`);

    // Transform and normalize the data
    const normalizedMentions = allPosts
      .slice(0, maxItems)
      .map(item => normalizeRedditItem(item, companyName));

    return normalizedMentions;
  } catch (error) {
    console.error('[RedditScraper] Error fetching Reddit mentions:', error.message);
    throw error;
  }
}

/**
 * Normalize Reddit item to a standard format for Threader AI
 * @param {Object} item - Raw Reddit item from Reddit JSON API
 * @param {string} companyName - The company being searched
 * @returns {Object} Normalized feedback item
 */
function normalizeRedditItem(item, companyName) {
  return {
    // Source identification
    source: 'reddit',
    sourceId: item.id,
    sourceUrl: item.url || `https://reddit.com${item.permalink}`,

    // Content
    title: item.title || null,
    body: item.selftext || item.body || '',
    author: item.author || '[deleted]',

    // Metadata
    subreddit: item.subreddit,
    upvotes: item.score || item.ups || 0,
    commentCount: item.num_comments || 0,
    upvoteRatio: item.upvote_ratio || null,
    flair: item.link_flair_text || null,

    // Timestamps
    createdAt: item.created_utc ? new Date(item.created_utc * 1000).toISOString() : null,
    scrapedAt: new Date().toISOString(),

    // Search context
    companyName: companyName,

    // Placeholder for analysis (to be filled by classification pipeline)
    analysis: {
      category: null,        // Bugs, Feature Requests, Usability Friction, Support Questions, Rants
      userSegment: null,     // Free, Paid, Enterprise
      impactType: null,      // Revenue, Retention, Brand Trust
      urgency: null,         // Blocks workflow, Affects many users
      sentiment: null,       // Positive, Negative, Neutral
    },

    // Comments will be fetched separately if needed
    comments: [],
  };
}

/**
 * Fetch comments for a specific post
 * @param {string} permalink - The post permalink
 * @returns {Promise<Array>} Array of comments
 */
export async function fetchPostComments(permalink) {
  try {
    const url = `https://www.reddit.com${permalink}.json`;
    const data = await fetchRedditJson(url);

    // Reddit returns [post, comments] array
    if (!data[1] || !data[1].data || !data[1].data.children) {
      return [];
    }

    return data[1].data.children
      .filter(child => child.kind === 't1') // t1 = comment
      .slice(0, 10)
      .map(child => ({
        id: child.data.id,
        body: child.data.body,
        author: child.data.author,
        upvotes: child.data.score || 0,
        createdAt: child.data.created_utc
          ? new Date(child.data.created_utc * 1000).toISOString()
          : null,
      }));
  } catch (error) {
    console.warn(`[RedditScraper] Could not fetch comments for ${permalink}:`, error.message);
    return [];
  }
}

/**
 * Fetch both posts and comments mentioning a company
 * @param {string} companyName - The company name to search for
 * @param {Object} options - Optional configuration
 * @returns {Promise<Object>} Object containing posts and comments arrays
 */
export async function fetchAllRedditMentions(companyName, options = {}) {
  const { maxItems = 50, includeComments = false } = options;

  console.log(`[RedditScraper] Fetching comprehensive Reddit data for "${companyName}"...`);

  // Get posts
  const posts = await fetchRedditMentions(companyName, { maxItems });

  // Optionally fetch comments for top posts
  if (includeComments && posts.length > 0) {
    console.log(`[RedditScraper] Fetching comments for top ${Math.min(5, posts.length)} posts...`);

    for (let i = 0; i < Math.min(5, posts.length); i++) {
      const post = posts[i];
      if (post.sourceUrl && post.sourceUrl.includes('reddit.com')) {
        const permalink = post.sourceUrl.replace('https://reddit.com', '').replace('https://www.reddit.com', '');
        posts[i].comments = await fetchPostComments(permalink);
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
      }
    }
  }

  console.log(`[RedditScraper] Found ${posts.length} posts`);

  return { posts, comments: [], total: posts.length };
}

/**
 * Check if a post is relevant to the company
 * @param {Object} post - The post to check
 * @param {string[]} searchTerms - Terms to search for
 * @returns {boolean} True if relevant
 */
function isRelevantPost(post, searchTerms) {
  const content = `${post.title || ''} ${post.body || ''}`.toLowerCase();
  return searchTerms.some(term => content.includes(term.toLowerCase()));
}

/**
 * Smart scraper: Discovers relevant subreddits using LLM, then scrapes them
 * This is the recommended way to scrape for a company
 * @param {string} companyName - The company name
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Scraped data with discovery info
 */
export async function smartScrape(companyName, options = {}) {
  const {
    maxItemsPerSubreddit = 100, // Reddit allows up to 100 per request
    useQuickDiscovery = false,
    companyContext = '',
    filterSecondary = true, // Filter secondary subreddits to only relevant posts
  } = options;

  console.log('='.repeat(60));
  console.log(`Smart Scrape for "${companyName}"`);
  console.log('='.repeat(60));

  // Step 1: Discover relevant subreddits
  let discovery;
  try {
    if (useQuickDiscovery || !process.env.OPENAI_API_KEY) {
      console.log('\n[Step 1] Quick subreddit discovery (no LLM)...');
      discovery = await quickDiscoverSubreddits(companyName);
    } else {
      console.log('\n[Step 1] LLM-powered subreddit discovery...');
      discovery = await discoverSubreddits(companyName, companyContext);
    }
  } catch (error) {
    console.error('[SmartScrape] Discovery failed:', error.message);
    console.log('[SmartScrape] Falling back to quick discovery...');
    discovery = await quickDiscoverSubreddits(companyName);
  }

  if (discovery.subreddits.length === 0) {
    console.log('\n[Warning] No relevant subreddits found. Searching Reddit-wide...');
    const mentions = await fetchRedditMentions(companyName, { maxItems: 50 });
    return {
      discovery: { subreddits: [], searchTerms: [companyName] },
      mentions,
      subredditResults: {},
    };
  }

  // Step 2: Scrape each subreddit
  console.log(`\n[Step 2] Scraping ${discovery.subreddits.length} subreddits...`);

  const allMentions = [];
  const subredditResults = {};

  for (const sub of discovery.subreddits) {
    console.log(`\n  Scraping r/${sub.name}...`);

    try {
      // Get new posts from the subreddit
      const posts = await fetchSubredditPosts(sub.name, {
        maxItems: maxItemsPerSubreddit,
        sort: 'new',
      });

      // For secondary subreddits, filter to only posts mentioning the company
      let relevantPosts = posts;
      if (filterSecondary && sub.relevance === 'secondary') {
        relevantPosts = posts.filter(post =>
          isRelevantPost(post, discovery.searchTerms)
        );
        console.log(`    Found ${posts.length} posts, ${relevantPosts.length} mention "${companyName}"`);
      } else {
        console.log(`    Found ${posts.length} recent posts`);
      }

      subredditResults[sub.name] = {
        total: posts.length,
        relevant: relevantPosts.length,
        relevance: sub.relevance,
      };

      // Tag posts with subreddit info
      const taggedPosts = relevantPosts.map(post => ({
        ...post,
        companyName,
        discoveredSubreddit: true,
        subredditRelevance: sub.relevance,
      }));

      allMentions.push(...taggedPosts);
    } catch (error) {
      console.error(`    Error scraping r/${sub.name}:`, error.message);
      subredditResults[sub.name] = { total: 0, relevant: 0, error: error.message };
    }

    // Rate limiting between subreddits
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
  }

  console.log(`\n[Step 3] Total posts collected: ${allMentions.length}`);

  return {
    discovery,
    mentions: allMentions,
    subredditResults,
  };
}

/**
 * Fetch recent posts from a specific subreddit
 * @param {string} subredditName - Subreddit name without r/
 * @param {Object} options - Configuration
 * @returns {Promise<Array>} Array of posts
 */
export async function fetchSubredditPosts(subredditName, options = {}) {
  const { maxItems = 25, sort = 'new', time = 'day' } = options;

  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);
  const oneDayAgoTimestamp = Math.floor(oneDayAgo.getTime() / 1000);

  const allPosts = [];
  let after = null;
  let fetchCount = 0;
  const maxFetches = Math.ceil(maxItems / 25);

  while (fetchCount < maxFetches && allPosts.length < maxItems) {
    const params = new URLSearchParams({
      sort,
      t: time,
      limit: '25',
    });

    if (after) {
      params.set('after', after);
    }

    const url = `https://www.reddit.com/r/${subredditName}/${sort}.json?${params.toString()}`;

    try {
      const data = await fetchRedditJson(url);

      if (!data.data || !data.data.children || data.data.children.length === 0) {
        break;
      }

      for (const child of data.data.children) {
        const post = child.data;
        // Only include posts from last 24 hours
        if (post.created_utc >= oneDayAgoTimestamp) {
          allPosts.push(normalizeRedditItem(post, subredditName));
        }
      }

      after = data.data.after;
      fetchCount++;

      if (!after) break;

      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    } catch (error) {
      console.error(`Error fetching r/${subredditName}:`, error.message);
      break;
    }
  }

  return allPosts.slice(0, maxItems);
}

// CLI execution for testing
async function main() {
  const companyName = process.argv[2] || 'Notion';
  const useSmartScrape = process.argv[3] !== '--basic';

  console.log('='.repeat(60));
  console.log('Threader AI - Reddit Scraper');
  console.log('='.repeat(60));

  if (useSmartScrape) {
    console.log('Mode: Smart Scrape (LLM-powered subreddit discovery)');
    console.log('='.repeat(60));

    try {
      const result = await smartScrape(companyName);

      console.log('\n' + '='.repeat(60));
      console.log('Summary');
      console.log('='.repeat(60));

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

      if (result.mentions.length > 0) {
        console.log('\nSample Posts:');
        result.mentions.slice(0, 5).forEach((post, i) => {
          console.log(`\n  [${i + 1}] r/${post.subreddit}`);
          console.log(`      ${post.title || '(No title)'}`);
          console.log(`      Upvotes: ${post.upvotes} | Comments: ${post.commentCount}`);
        });
      }

      // Output JSON
      console.log('\n' + '='.repeat(60));
      console.log('Raw JSON (first 10):');
      console.log('='.repeat(60));
      console.log(JSON.stringify(result.mentions.slice(0, 10), null, 2));

      return result;
    } catch (error) {
      console.error('Smart scrape failed:', error);
      process.exit(1);
    }
  } else {
    console.log('Mode: Basic (Reddit-wide search)');
    console.log('='.repeat(60));

    try {
      const mentions = await fetchRedditMentions(companyName, { maxItems: 50 });

      console.log(`\nFound ${mentions.length} mentions`);

      mentions.slice(0, 10).forEach((mention, index) => {
        console.log(`\n[${index + 1}] r/${mention.subreddit}`);
        console.log(`    ${mention.title || '(Comment)'}`);
      });

      return mentions;
    } catch (error) {
      console.error('Scrape failed:', error);
      process.exit(1);
    }
  }
}

// Run if executed directly
main();
