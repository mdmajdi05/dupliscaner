#!/usr/bin/env node
/**
 * test-db-scan.js — Test harness for ScanProcessor
 * 
 * Usage:
 * node test-db-scan.js duplicates
 * node test-db-scan.js full
 */

const { spawn } = require('child_process');
const readline = require('readline');
const { createScanProcessor, processScannerStream } = require('./lib/db-scan');
const path = require('path');

async function runTest(mode = 'duplicates') {
  console.log(`\n🧪 Testing ScanProcessor with ${mode} mode...\n`);

  // Create processor
  const processor = await createScanProcessor(1, mode);

  // Spawn scanner process
  const scanPath = process.env.SCAN_PATH || process.env.LOCALAPPDATA 
    ? path.join(process.env.LOCALAPPDATA, 'DupScan')
    : 'C:\\Users\\md majdi\\AppData\\Local\\DupScan';

  console.log(`📁 Scanning: ${scanPath}`);
  console.log(`⏱️  Mode: ${mode}\n`);

  const args = [
    'scanner.py',
    '--path', scanPath,
    '--mode', mode,
    '--hidden',
  ];

  const scanProcess = spawn('python', args, {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Create readline interface for JSON-line events
  const rl = readline.createInterface({
    input: scanProcess.stdout,
    crlfDelay: Infinity,
  });

  let eventCount = 0;
  let fileCount = 0;
  let dupCount = 0;

  // Override processEvent to track stats
  const originalProcessEvent = processor.processEvent.bind(processor);
  processor.processEvent = async function(event) {
    eventCount++;
    
    if (event.type === 'file_record' || event.type === 'file_hashed') fileCount++;
    if (event.type === 'dup') dupCount++;
    
    if (eventCount % 100 === 0) {
      console.log(`📊 Events: ${eventCount} | Files: ${fileCount} | Dups: ${dupCount}`);
    }

    return originalProcessEvent(event);
  };

  // Process stream
  try {
    await processScannerStream(rl, processor);
    
    console.log(`\n✅ Test completed successfully!`);
    console.log(`   Total events: ${eventCount}`);
    console.log(`   Files processed: ${fileCount}`);
    console.log(`   Duplicates found: ${dupCount}`);
  } catch (err) {
    console.error(`\n❌ Test failed:`, err.message);
    process.exit(1);
  }

  // Print scanner stderr if any
  scanProcess.stderr.on('data', (data) => {
    console.error(`[Scanner Error] ${data.toString().trim()}`);
  });

  await new Promise(resolve => scanProcess.on('close', resolve));
}

// Run test
const mode = process.argv[2] || 'duplicates';
runTest(mode).catch(console.error);
