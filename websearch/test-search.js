#!/usr/bin/env node

import { spawn } from 'child_process';

const server = spawn('node', ['build/index.js'], {
  env: { ...process.env, TRANSPORT: 'stdio' },
  stdio: ['pipe', 'pipe', 'inherit']
});

// Send tools/list request
const listRequest = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "tools/list",
  params: {}
});

server.stdin.write(listRequest + '\n');

let response = '';
server.stdout.on('data', (data) => {
  response += data.toString();
  try {
    const parsed = JSON.parse(response);
    console.log('Tools list response:', JSON.stringify(parsed, null, 2));
    
    // Now test the search
    const searchRequest = JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "get_links",
        arguments: {
          query: "test search"
        }
      }
    });
    
    server.stdin.write(searchRequest + '\n');
  } catch (e) {
    // Not complete JSON yet
  }
});

server.stdout.on('end', () => {
  console.log('Final response:', response);
});

setTimeout(() => {
  server.kill();
}, 5000);
