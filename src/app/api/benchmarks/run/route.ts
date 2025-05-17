import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST() {
  try {
    // Execute the benchmark script asynchronously
    // This runs in the background and doesn't block the response
    const scriptPath = process.cwd() + '/scripts/run-benchmarks.js';
    
    // Start the benchmark process without waiting for it to complete
    // We explicitly use the --port flag to avoid port conflicts (port 4000 was already in use)
    exec(`node ${scriptPath} --server=false --port 8765`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Benchmark execution error: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`Benchmark stderr: ${stderr}`);
        return;
      }
      console.log(`Benchmark started: ${stdout}`);
    });

    // Return a success response immediately
    return NextResponse.json({ 
      success: true, 
      message: 'Benchmark started successfully', 
      status: 'running'
    });
  } catch (error) {
    console.error('Failed to start benchmark:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start benchmark' },
      { status: 500 }
    );
  }
} 