#!/usr/bin/env node

// Simple test to check X.com accessibility
async function testXAccess() {
  console.log('Testing X.com access...');
  
  const usernames = ['elonmusk', 'twitter', 'nasa'];
  
  for (const username of usernames) {
    try {
      console.log(`\nTesting ${username}...`);
      
      // Test direct X.com
      const response = await fetch(`https://x.com/${username}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      console.log(`Status: ${response.status}`);
      console.log(`Content-Type: ${response.headers.get('content-type')}`);
      
      if (response.ok) {
        const text = await response.text();
        console.log(`Content length: ${text.length}`);
        
        // Check for tweet indicators
        const hasTweets = text.includes('data-testid="tweet"') || 
                         text.includes('tweet') || 
                         text.includes('status');
        console.log(`Has tweets: ${hasTweets}`);
      }
      
    } catch (error) {
      console.error(`Error with ${username}:`, error.message);
    }
  }
  
  // Test nitter
  console.log('\nTesting nitter instances...');
  const nitterInstances = ['https://nitter.net', 'https://nitter.it'];
  
  for (const instance of nitterInstances) {
    try {
      const response = await fetch(`${instance}/elonmusk`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      console.log(`${instance} status: ${response.status}`);
      if (response.ok) {
        const text = await response.text();
        console.log(`${instance} content length: ${text.length}`);
      }
    } catch (error) {
      console.error(`Error with ${instance}:`, error.message);
    }
  }
}

testXAccess();
