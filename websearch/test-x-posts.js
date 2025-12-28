#!/usr/bin/env node

// Direct test of X posts scraper
async function testXPosts() {
  try {
    console.log('Testing X posts scraper...');
    
    // Test the scraping function directly
    const { scrapeLatestXPosts } = await import('./build/adapters/x-posts.adapter.js');
    
    const posts = await scrapeLatestXPosts('elonmusk', 3);
    
    console.log(`Found ${posts.length} posts:`);
    posts.forEach((post, index) => {
      console.log(`\nPost ${index + 1}:`);
      console.log(`ID: ${post.id}`);
      console.log(`Text: ${post.text.substring(0, 100)}...`);
      console.log(`URL: ${post.url}`);
      console.log(`Metrics: ${JSON.stringify(post.metrics)}`);
    });
    
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testXPosts();
