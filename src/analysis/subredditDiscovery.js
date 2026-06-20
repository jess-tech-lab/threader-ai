import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const llm = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0.3,
});

const subredditSchema = z.object({
  subreddits: z.array(z.object({
    name: z.string().describe('Subreddit name without r/ prefix'),
    relevance: z.enum(['primary', 'secondary']).describe('Primary = official/dedicated, Secondary = related/industry'),
    reason: z.string().describe('Why this subreddit is relevant'),
  })).describe('List of relevant subreddits for the company'),
  searchTerms: z.array(z.string()).describe('Additional search terms/product names to look for'),
});

const discoveryPrompt = ChatPromptTemplate.fromMessages([
  ['system', `You are a Reddit expert helping identify subreddits where users discuss a specific company or product.

Your task is to suggest subreddits where:
1. The company has an official or dedicated subreddit (e.g., r/Notion for Notion)
2. Users commonly discuss the product (e.g., r/productivity for productivity tools)
3. Competitor comparisons happen (e.g., r/ObsidianMD might discuss Notion alternatives)
4. Industry-specific discussions occur (e.g., r/startups for B2B tools)

Guidelines:
- Prioritize subreddits where actual users post feedback, complaints, or feature requests
- Include both official subreddits and community-driven ones
- For tech companies, include relevant tech/programming subreddits
- Avoid overly generic subreddits (like r/AskReddit) unless highly relevant
- Return 5-15 subreddits, ordered by relevance

Also suggest search terms beyond the company name (product names, common misspellings, abbreviations).`],
  ['human', `Find relevant subreddits for the company: {companyName}

Additional context about the company (if available): {companyContext}`],
]);

const structuredLlm = llm.withStructuredOutput(subredditSchema);
const discoveryChain = discoveryPrompt.pipe(structuredLlm);

async function validateSubreddit(subredditName) {
  try {
    const response = await fetch(
      `https://www.reddit.com/r/${subredditName}/about.json`,
      { headers: { 'User-Agent': USER_AGENT } }
    );

    if (!response.ok) return null;

    const data = await response.json();

    if (data.error || !data.data) return null;

    return {
      name: data.data.display_name,
      subscribers: data.data.subscribers,
      description: data.data.public_description || data.data.description,
      isNsfw: data.data.over18,
      isPrivate: data.data.subreddit_type === 'private',
    };
  } catch {
    return null;
  }
}

export async function discoverSubreddits(companyName, companyContext = '') {
  console.log(`[SubredditDiscovery] Finding relevant subreddits for "${companyName}"...`);

  const suggestions = await discoveryChain.invoke({
    companyName,
    companyContext: companyContext || 'No additional context provided',
  });

  console.log(`[SubredditDiscovery] LLM suggested ${suggestions.subreddits.length} subreddits`);
  console.log(`[SubredditDiscovery] Validating subreddits...`);

  const validatedSubreddits = [];

  for (const sub of suggestions.subreddits) {
    const info = await validateSubreddit(sub.name);

    if (info && !info.isPrivate && !info.isNsfw) {
      validatedSubreddits.push({ ...sub, ...info, exists: true });
      console.log(`  ✓ r/${sub.name} (${info.subscribers?.toLocaleString() || '?'} subscribers)`);
    } else {
      console.log(`  ✗ r/${sub.name} (not found or private)`);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`[SubredditDiscovery] Found ${validatedSubreddits.length} valid subreddits`);

  return {
    companyName,
    subreddits: validatedSubreddits,
    searchTerms: [companyName, ...suggestions.searchTerms],
  };
}

export async function quickDiscoverSubreddits(companyName) {
  console.log(`[SubredditDiscovery] Quick discovery for "${companyName}"...`);

  const potentialNames = [
    companyName.toLowerCase(),
    `${companyName.toLowerCase()}app`,
    `${companyName.toLowerCase()}hq`,
    `${companyName.toLowerCase()}official`,
  ];

  const validatedSubreddits = [];

  for (const name of potentialNames) {
    const info = await validateSubreddit(name);

    if (info && !info.isPrivate && info.subscribers > 100) {
      validatedSubreddits.push({
        name: info.name,
        relevance: 'primary',
        reason: 'Matches company name pattern',
        ...info,
        exists: true,
      });
      console.log(`  ✓ r/${info.name} (${info.subscribers?.toLocaleString()} subscribers)`);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return {
    companyName,
    subreddits: validatedSubreddits,
    searchTerms: [companyName],
  };
}

async function main() {
  const companyName = process.argv[2] || 'Notion';

  if (!process.env.OPENAI_API_KEY) {
    console.log('\nNo OPENAI_API_KEY found, using quick discovery...\n');
    const result = await quickDiscoverSubreddits(companyName);
    console.log('\nResults:', JSON.stringify(result, null, 2));
    return;
  }

  try {
    const result = await discoverSubreddits(companyName);

    console.log('\nValidated Subreddits:');
    result.subreddits.forEach((sub, i) => {
      console.log(`  ${i + 1}. r/${sub.name} [${sub.relevance}]`);
      console.log(`     Subscribers: ${sub.subscribers?.toLocaleString() || 'N/A'}`);
      console.log(`     Reason: ${sub.reason}`);
    });

    console.log('\nSearch Terms:', result.searchTerms.join(', '));
  } catch (error) {
    console.error('Discovery failed:', error.message);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
