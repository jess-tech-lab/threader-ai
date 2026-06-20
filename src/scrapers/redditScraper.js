import dotenv from 'dotenv';
import { discoverSubreddits, quickDiscoverSubreddits } from '../analysis/subredditDiscovery.js';

dotenv.config();

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const RATE_LIMIT_DELAY = 2000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchRedditJson(url, retries = 3) {
  const jsonUrl = url.includes('.json') ? url : `${url}.json`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
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
        console.log(`[RedditScraper] Rate limited, waiting 30s before retry ${attempt}/${retries}...`);
        await sleep(30000);
        continue;
      }

      if (response.status === 403) {
        console.log(`[RedditScraper] Blocked (403), waiting 10s before retry ${attempt}/${retries}...`);
        await sleep(10000);
        continue;
      }

      if (!response.ok) {
        throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      if (attempt === retries) throw error;
      console.log(`[RedditScraper] Request failed, retrying... (${attempt}/${retries})`);
      await sleep(5000);
    }
  }
}

export async function fetchRedditMentions(companyName, options = {}) {
  const { maxItems = 100, subreddits = [] } = options;

  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);
  const oneDayAgoTimestamp = Math.floor(oneDayAgo.getTime() / 1000);

  console.log(`[RedditScraper] Searching for "${companyName}" mentions...`);
  console.log(`[RedditScraper] Timeframe: Last 24 hours (since ${oneDayAgo.toISOString()})`);

  const allPosts = [];
  let after = null;
  let fetchCount = 0;
  const maxFetches = Math.ceil(maxItems / 25);

  try {
    const baseUrl = subreddits.length > 0
      ? `https://www.reddit.com/r/${subreddits.join('+')}/search.json`
      : 'https://www.reddit.com/search.json';

    while (fetchCount < maxFetches && allPosts.length < maxItems) {
      const params = new URLSearchParams({
        q: companyName,
        sort: 'new',
        t: 'day',
        limit: '25',
        restrict_sr: subreddits.length > 0 ? '1' : '0',
      });

      if (after) params.set('after', after);

      const url = `${baseUrl}?${params.toString()}`;
      console.log(`[RedditScraper] Fetching page ${fetchCount + 1}...`);

      const data = await fetchRedditJson(url);

      if (!data.data || !data.data.children || data.data.children.length === 0) break;

      for (const child of data.data.children) {
        const post = child.data;
        if (post.created_utc >= oneDayAgoTimestamp) allPosts.push(post);
      }

      after = data.data.after;
      fetchCount++;

      if (!after) break;

      await sleep(RATE_LIMIT_DELAY);
    }

    console.log(`[RedditScraper] Found ${allPosts.length} mentions in the last 24 hours`);

    return allPosts.slice(0, maxItems).map(item => normalizeRedditItem(item, companyName));
  } catch (error) {
    console.error('[RedditScraper] Error fetching Reddit mentions:', error.message);
    throw error;
  }
}

function normalizeRedditItem(item, companyName) {
  return {
    source: 'reddit',
    sourceId: item.id,
    sourceUrl: item.url || `https://reddit.com${item.permalink}`,
    title: item.title || null,
    body: item.selftext || item.body || '',
    author: item.author || '[deleted]',
    subreddit: item.subreddit,
    upvotes: item.score || item.ups || 0,
    commentCount: item.num_comments || 0,
    upvoteRatio: item.upvote_ratio || null,
    flair: item.link_flair_text || null,
    createdAt: item.created_utc ? new Date(item.created_utc * 1000).toISOString() : null,
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

export async function fetchPostComments(permalink) {
  try {
    const url = `https://www.reddit.com${permalink}.json`;
    const data = await fetchRedditJson(url);

    // Reddit returns [post_listing, comment_listing]
    if (!data[1] || !data[1].data || !data[1].data.children) return [];

    return data[1].data.children
      .filter(child => child.kind === 't1')
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

export async function fetchAllRedditMentions(companyName, options = {}) {
  const { maxItems = 50, includeComments = false } = options;

  console.log(`[RedditScraper] Fetching comprehensive Reddit data for "${companyName}"...`);

  const posts = await fetchRedditMentions(companyName, { maxItems });

  if (includeComments && posts.length > 0) {
    console.log(`[RedditScraper] Fetching comments for top ${Math.min(5, posts.length)} posts...`);

    for (let i = 0; i < Math.min(5, posts.length); i++) {
      const post = posts[i];
      if (post.sourceUrl && post.sourceUrl.includes('reddit.com')) {
        const permalink = post.sourceUrl.replace('https://reddit.com', '').replace('https://www.reddit.com', '');
        posts[i].comments = await fetchPostComments(permalink);
        await sleep(RATE_LIMIT_DELAY);
      }
    }
  }

  console.log(`[RedditScraper] Found ${posts.length} posts`);

  return { posts, comments: [], total: posts.length };
}

function isRelevantPost(post, searchTerms) {
  const content = `${post.title || ''} ${post.body || ''}`.toLowerCase();
  return searchTerms.some(term => content.includes(term.toLowerCase()));
}

export async function smartScrape(companyName, options = {}) {
  const {
    maxItemsPerSubreddit = 100,
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
    console.log('\n[Warning] No relevant subreddits found. Searching Reddit-wide...');
    const mentions = await fetchRedditMentions(companyName, { maxItems: 50 });
    return {
      discovery: { subreddits: [], searchTerms: [companyName] },
      mentions,
      subredditResults: {},
    };
  }

  console.log(`\n[Step 2] Scraping ${discovery.subreddits.length} subreddits...`);

  const allMentions = [];
  const subredditResults = {};

  for (const sub of discovery.subreddits) {
    console.log(`\n  Scraping r/${sub.name}...`);

    try {
      const posts = await fetchSubredditPosts(sub.name, {
        maxItems: maxItemsPerSubreddit,
        sort: 'new',
      });

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

    await sleep(RATE_LIMIT_DELAY);
  }

  console.log(`\n[Step 3] Total posts collected: ${allMentions.length}`);

  return { discovery, mentions: allMentions, subredditResults };
}

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
    const params = new URLSearchParams({ sort, t: time, limit: '25' });

    if (after) params.set('after', after);

    const url = `https://www.reddit.com/r/${subredditName}/${sort}.json?${params.toString()}`;

    try {
      const data = await fetchRedditJson(url);

      if (!data.data || !data.data.children || data.data.children.length === 0) break;

      for (const child of data.data.children) {
        const post = child.data;
        if (post.created_utc >= oneDayAgoTimestamp) {
          allPosts.push(normalizeRedditItem(post, subredditName));
        }
      }

      after = data.data.after;
      fetchCount++;

      if (!after) break;

      await sleep(RATE_LIMIT_DELAY);
    } catch (error) {
      console.error(`Error fetching r/${subredditName}:`, error.message);
      break;
    }
  }

  return allPosts.slice(0, maxItems);
}

async function main() {
  const companyName = process.argv[2] || 'Notion';
  const useSmartScrape = process.argv[3] !== '--basic';

  if (useSmartScrape) {
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

      if (result.mentions.length > 0) {
        result.mentions.slice(0, 5).forEach((post, i) => {
          console.log(`\n  [${i + 1}] r/${post.subreddit}`);
          console.log(`      ${post.title || '(No title)'}`);
          console.log(`      Upvotes: ${post.upvotes} | Comments: ${post.commentCount}`);
        });
      }

      console.log(JSON.stringify(result.mentions.slice(0, 10), null, 2));
    } catch (error) {
      console.error('Smart scrape failed:', error);
      process.exit(1);
    }
  } else {
    try {
      const mentions = await fetchRedditMentions(companyName, { maxItems: 50 });

      console.log(`\nFound ${mentions.length} mentions`);
      mentions.slice(0, 10).forEach((mention, index) => {
        console.log(`\n[${index + 1}] r/${mention.subreddit}`);
        console.log(`    ${mention.title || '(Comment)'}`);
      });
    } catch (error) {
      console.error('Scrape failed:', error);
      process.exit(1);
    }
  }
}

// Only run if executed directly. Otherwise, serve as import.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
