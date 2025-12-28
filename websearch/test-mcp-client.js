#!/usr/bin/env node

import { spawn } from 'child_process';

// Start the MCP server
const server = spawn('node', ['build/index.js'], {
  env: { ...process.env, TRANSPORT: 'stdio' },
  stdio: ['pipe', 'pipe', 'inherit']
});

let responseBuffer = '';
let requestId = 1;

server.stdout.on('data', (data) => {
  responseBuffer += data.toString();
  console.log('Raw response:', data.toString());
  
  // Try to parse complete JSON responses
  const lines = responseBuffer.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].trim()) {
      try {
        const response = JSON.parse(lines[i]);
        console.log('Parsed response:', JSON.stringify(response, null, 2));
        
        // If this was the tools/list response, test a search
        if (response.id === 1 && response.result?.tools) {
          console.log('Testing search functionality...');
          const searchRequest = {
            jsonrpc: "2.0",
            id: ++requestId,
            method: "tools/call",
            params: {
              name: "get_links",
              arguments: {
                query: "test search"
              }
            }
          };
          server.stdin.write(JSON.stringify(searchRequest) + '\n');
        }
        
        // Exit after search response
        if (response.id === 2) {
          setTimeout(() => {
            server.kill();
            process.exit(0);
          }, 100);
        }
      } catch (e) {
        console.log('Not valid JSON yet:', lines[i]);
      }
    }
  }
  responseBuffer = lines[lines.length - 1]; // Keep last incomplete line
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

server.on('exit', (code) => {
  console.log('Server exited with code:', code);
  process.exit(code);
});

// Start with tools/list
const listRequest = {
  jsonrpc: "2.0",
  id: requestId,
  method: "tools/list",
  params: {}
};

console.log('Sending tools/list request...');
server.stdin.write(JSON.stringify(listRequest) + '\n');

// Timeout after 10 seconds
setTimeout(() => {
  console.log('Timeout, killing server...');
  server.kill();
  process.exit(1);
}, 10000);
