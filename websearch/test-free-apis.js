// Direct test of Free APIs
async function testFreeAPIs() {
  try {
    console.log('Testing JSONPlaceholder Users API...');
    const response = await fetch('https://jsonplaceholder.typicode.com/users');
    const users = await response.json();
    console.log(`Found ${users.length} users`);
    console.log('First user:', JSON.stringify(users[0], null, 2));
    
    console.log('\nTesting Quotes API...');
    const quotesResponse = await fetch('https://api.quotable.io/quotes?limit=2');
    const quotesData = await quotesResponse.json();
    console.log(`Found ${quotesData.results?.length || 0} quotes`);
    console.log('First quote:', JSON.stringify(quotesData.results?.[0], null, 2));
    
    console.log('\nTesting Random User API...');
    const userResponse = await fetch('https://randomuser.me/api/');
    const userData = await userResponse.json();
    console.log('Random user:', JSON.stringify(userData.results?.[0], null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testFreeAPIs();
