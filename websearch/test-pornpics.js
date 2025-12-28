// Direct test of PornPics function
import { searchPornPics } from './build/adapters/pornpics.adapter.js';

async function testPornPics() {
  try {
    console.log('Testing PornPics search directly...');
    const results = await searchPornPics('amateur', 3, 0);
    console.log(`Found ${results.total_images} images:`);
    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testPornPics();
