#!/usr/bin/env node

const { spawn } = require('child_process');

const child = spawn('node', ['build/index.js'], {
  env: { ...process.env, TRANSPORT: 'stdio' },
  stdio: ['pipe', 'pipe', 'inherit']
});

// Send the request
const request = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "tools/list",
  params: {}
});

child.stdin.write(request + '\n');

let response = '';
child.stdout.on('data', (data) => {
  response += data.toString();
  console.log('Received:', data.toString());
});

child.stdout.on('end', () => {
  console.log('Complete response:', response);
});

setTimeout(() => {
  child.kill();
}, 5000);
