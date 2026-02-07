#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

let input = '';

process.stdin.setEncoding('utf8');

process.stdin.on('readable', () => {
  let chunk;
  while (null !== (chunk = process.stdin.read())) {
    input += chunk;
  }
});

process.stdin.on('end', () => {
  const logFile = path.join(__dirname, 'debug.log');
  
  try {
    fs.writeFileSync(logFile, `=== ${new Date().toISOString()} ===\n`);
    fs.appendFileSync(logFile, `Raw input:\n${input}\n\n`);
    
    if (!input || input.trim() === '') {
      fs.appendFileSync(logFile, 'No input received\n');
      process.exit(0);
    }
    
    const context = JSON.parse(input);
    fs.appendFileSync(logFile, `Parsed:\n${JSON.stringify(context, null, 2)}\n\n`);
    
    // CORRECT LOCATION: tool_input.file_path
    const filePath = context.tool_input?.file_path || '';
    
    fs.appendFileSync(logFile, `File path: "${filePath}"\n`);
    
    // Block .env files
    if (filePath && filePath.includes('.env')) {
      fs.appendFileSync(logFile, 'BLOCKED\n');
      process.stderr.write('🚫 Access to .env files is blocked\n');
      process.exit(2);
    }
    
    fs.appendFileSync(logFile, 'ALLOWED\n');
    process.exit(0);
    
  } catch (error) {
    fs.appendFileSync(logFile, `Error: ${error.message}\n`);
    process.stderr.write(`Hook error: ${error.message}\n`);
    process.exit(2);
  }
});