#!/usr/bin/env node

const { spawn } = require('child_process');

const server = spawn('node', ['build/index.js', '--stdio'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

// Send initialize request
server.stdin.write(JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: { tools: {} },
    clientInfo: { name: "test", version: "1.0.0" }
  }
}) + '\n');

// Send tools/list request
setTimeout(() => {
  server.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  }) + '\n');
}, 1000);

// Read responses
server.stdout.on('data', (data) => {
  console.log('Response:', data.toString());
});

// Handle server exit
server.on('close', (code) => {
  console.log(`Server exited with code ${code}`);
});

// Timeout after 10 seconds
setTimeout(() => {
  server.kill();
  console.log('Test timeout');
}, 10000);
