import { promises as fs } from 'fs';
import path from 'path';
import { parse } from 'json2csv';

interface AnalyticsExportOptions {
  outputDir: string;
  startDate?: Date;
  endDate?: Date;
  formats: ('json' | 'csv')[];
  groupBy?: 'session' | 'user' | 'day' | 'event' | 'variant';
}

// Log event structure from server-side JSONL files
interface LogEvent {
  id: string;
  timestamp: string;
  action?: string;
  type?: string;
  sessionId?: string;
  userId?: string;
  query?: string;
  success?: boolean;
  variant?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

/**
 * Load logs from JSONL file
 */
async function loadLogsFromJsonl(filePath: string): Promise<LogEvent[]> {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    const lines = data.trim().split('\n');
    return lines.map(line => JSON.parse(line));
  } catch (error) {
    console.error(`Error loading logs from ${filePath}:`, error);
    return [];
  }
}

/**
 * Group events by the specified field
 */
function groupEvents(events: LogEvent[], groupBy: string): Record<string, LogEvent[]> {
  const grouped: Record<string, LogEvent[]> = {};
  
  events.forEach(event => {
    let key: string;
    
    switch (groupBy) {
      case 'session':
        key = event.sessionId || 'unknown';
        break;
      case 'user':
        key = event.userId || 'anonymous';
        break;
      case 'variant':
        key = event.variant || 'default';
        break;
      case 'day':
        key = new Date(event.timestamp).toISOString().split('T')[0];
        break;
      case 'event':
        key = event.action || event.type || 'unknown';
        break;
      default:
        key = 'all';
    }
    
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(event);
  });
  
  return grouped;
}

/**
 * Export logs to the specified format
 */
async function exportLogs(events: LogEvent[], options: AnalyticsExportOptions): Promise<void> {
  // Create output directory if it doesn't exist
  await fs.mkdir(options.outputDir, { recursive: true });
  
  // Filter events by date if specified
  let filteredEvents = [...events];
  
  if (options.startDate) {
    filteredEvents = filteredEvents.filter(event => 
      new Date(event.timestamp) >= options.startDate!
    );
  }
  
  if (options.endDate) {
    filteredEvents = filteredEvents.filter(event => 
      new Date(event.timestamp) <= options.endDate!
    );
  }
  
  // Group events if specified
  let exportData: Record<string, any>;
  
  if (options.groupBy) {
    exportData = groupEvents(filteredEvents, options.groupBy);
  } else {
    exportData = { all: filteredEvents };
  }
  
  // Export data in each requested format
  for (const format of options.formats) {
    for (const [group, groupEvents] of Object.entries(exportData)) {
      const timestamp = new Date().toISOString().replace(/[:T.]/g, '-').slice(0, 19);
      const filename = `analytics-${group}-${timestamp}.${format}`;
      const outputPath = path.join(options.outputDir, filename);
      
      if (format === 'json') {
        await fs.writeFile(outputPath, JSON.stringify(groupEvents, null, 2));
      } else if (format === 'csv') {
        // Convert to CSV using json2csv
        try {
          const csv = parse(groupEvents);
          await fs.writeFile(outputPath, csv);
        } catch (error) {
          console.error(`Error converting to CSV for group ${group}:`, error);
          // Fallback to JSON if CSV conversion fails
          const fallbackPath = path.join(options.outputDir, `analytics-${group}-${timestamp}.json`);
          await fs.writeFile(fallbackPath, JSON.stringify(groupEvents, null, 2));
        }
      }
      
      console.log(`Exported ${groupEvents.length} events to ${outputPath}`);
    }
  }
}

/**
 * Main function to export analytics data
 */
async function exportAnalytics(options: AnalyticsExportOptions): Promise<void> {
  console.log('Exporting analytics data...');
  
  // Define data sources
  const dataDir = path.join(process.cwd(), 'data');
  const sources = [
    { name: 'session-logs', path: path.join(dataDir, 'session-logs.jsonl') },
    { name: 'assistant-logs', path: path.join(dataDir, 'assistant-logs.jsonl') },
    { name: 'activity-logs', path: path.join(dataDir, 'activity-logs.jsonl') }
  ];
  
  // Load and export data from each source
  for (const source of sources) {
    try {
      console.log(`Loading data from ${source.name}...`);
      const events = await loadLogsFromJsonl(source.path);
      
      if (events.length === 0) {
        console.log(`No events found in ${source.name}`);
        continue;
      }
      
      console.log(`Found ${events.length} events in ${source.name}`);
      
      // Create source-specific output directory
      const sourceOutputDir = path.join(options.outputDir, source.name);
      
      // Export data for this source
      await exportLogs(events, {
        ...options,
        outputDir: sourceOutputDir
      });
      
      console.log(`Exported data from ${source.name}`);
    } catch (error) {
      console.error(`Error processing ${source.name}:`, error);
    }
  }
  
  console.log('Analytics export completed!');
}

/**
 * Process command line arguments
 */
function parseCommandLineArgs(): AnalyticsExportOptions {
  const args = process.argv.slice(2);
  const options: AnalyticsExportOptions = {
    outputDir: path.join(process.cwd(), 'analytics-export'),
    formats: ['json', 'csv']
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--output' || arg === '-o') {
      options.outputDir = args[++i];
    } else if (arg === '--format' || arg === '-f') {
      const formatArg = args[++i];
      options.formats = formatArg.split(',') as ('json' | 'csv')[];
    } else if (arg === '--start-date') {
      options.startDate = new Date(args[++i]);
    } else if (arg === '--end-date') {
      options.endDate = new Date(args[++i]);
    } else if (arg === '--group-by' || arg === '-g') {
      options.groupBy = args[++i] as any;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  
  return options;
}

/**
 * Print help information
 */
function printHelp(): void {
  console.log(`
Export Analytics - Extract and export analytics data

Usage:
  ts-node export-analytics.ts [options]

Options:
  --output, -o <path>       Output directory (default: "./analytics-export")
  --format, -f <formats>    Output formats: json,csv (default: both)
  --start-date <date>       Filter events after this date (ISO format)
  --end-date <date>         Filter events before this date (ISO format)
  --group-by, -g <field>    Group events by: session, user, day, event, variant
  --help, -h                Show this help message

Examples:
  ts-node export-analytics.ts --format csv --group-by session
  ts-node export-analytics.ts --start-date 2023-01-01 --end-date 2023-01-31
  `);
}

/**
 * Run the export process
 */
async function main(): Promise<void> {
  try {
    const options = parseCommandLineArgs();
    await exportAnalytics(options);
  } catch (error) {
    console.error('Export failed:', error);
    process.exit(1);
  }
}

// Run the script
main(); 