import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

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

export async function discoverSubreddits(companyName, companyContext = '') {
  console.log(`[SubredditDiscovery] Finding relevant subreddits for "${companyName}"...`);

  const suggestions = await discoveryChain.invoke({
    companyName,
    companyContext: companyContext || 'No additional context provided',
  });

  console.log(`[SubredditDiscovery] Found ${suggestions.subreddits.length} subreddits`);
  suggestions.subreddits.forEach(sub => {
    console.log(`  r/${sub.name} [${sub.relevance}]`);
  });

  return {
    companyName,
    subreddits: suggestions.subreddits.map(sub => ({ ...sub, exists: true })),
    searchTerms: [companyName, ...suggestions.searchTerms],
  };
}

// Quick fallback when OpenAI is unavailable — generates name pattern candidates
export async function quickDiscoverSubreddits(companyName) {
  console.log(`[SubredditDiscovery] Quick discovery for "${companyName}"...`);

  const name = companyName.toLowerCase();
  const subreddits = [
    { name, relevance: 'primary', reason: 'Company name subreddit', exists: true },
    { name: `${name}app`, relevance: 'primary', reason: 'App subreddit pattern', exists: true },
  ];

  return {
    companyName,
    subreddits,
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

    console.log('\nSubreddits:');
    result.subreddits.forEach((sub, i) => {
      console.log(`  ${i + 1}. r/${sub.name} [${sub.relevance}] — ${sub.reason}`);
    });

    console.log('\nSearch Terms:', result.searchTerms.join(', '));
  } catch (error) {
    console.error('Discovery failed:', error.message);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
