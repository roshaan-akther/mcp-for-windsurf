// Direct test of X posts function
import { scrapeLatestXPosts } from './build/adapters/x-posts.adapter.js';

async function testDirect() {
  try {
    console.log('Testing X posts scraper directly...');
    const posts = await scrapeLatestXPosts('elonmusk', 3);
    console.log(`Found ${posts.length} posts:`);
    console.log(JSON.stringify(posts, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testDirect();
