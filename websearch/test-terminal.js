// Test terminal functionality
const { spawn } = require('child_process');
const { randomUUID } = require('crypto');

// Test creating a terminal session
function testTerminal() {
  console.log('Testing terminal functionality...');
  
  const sessionId = randomUUID();
  console.log(`Session ID: ${sessionId}`);
  
  // Test simple command
  const child = spawn('echo', ['Hello from terminal'], {
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let stdout = '';
  let stderr = '';
  
  child.stdout?.on('data', (data) => {
    stdout += data.toString();
    console.log('STDOUT:', data.toString().trim());
  });
  
  child.stderr?.on('data', (data) => {
    stderr += data.toString();
    console.log('STDERR:', data.toString().trim());
  });
  
  child.on('close', (code) => {
    console.log(`Process exited with code: ${code}`);
    console.log('Test completed successfully!');
  });
  
  child.on('error', (error) => {
    console.error('Process error:', error.message);
  });
}

testTerminal();
