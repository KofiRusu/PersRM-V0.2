// Script to query reasoning logs using Prisma Client
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Query the most recent reasoning logs
    const logs = await prisma.reasoningTestLog.findMany({
      take: 10,
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        prompt: true,
        responseTime: true,
        model: true,
        score: true,
        errorMessage: true,
        metadata: true,
        createdAt: true
      }
    });

    console.log('Recent reasoning logs:');
    console.log(JSON.stringify(logs, null, 2));

    // Count logs by model
    const modelCounts = await prisma.reasoningTestLog.groupBy({
      by: ['model'],
      _count: true,
    });

    console.log('\nLogs by model:');
    console.log(modelCounts);

    // Count logs by score
    const scoreCounts = await prisma.reasoningTestLog.groupBy({
      by: ['score'],
      _count: true,
      orderBy: {
        score: 'desc'
      }
    });

    console.log('\nLogs by score:');
    console.log(scoreCounts);

    // Average response time by model
    const responseTimeByModel = await prisma.reasoningTestLog.groupBy({
      by: ['model'],
      _avg: {
        responseTime: true
      },
      orderBy: {
        _avg: {
          responseTime: 'asc'
        }
      }
    });

    console.log('\nAverage response time by model (ms):');
    console.log(responseTimeByModel);

    // Average score by model
    const scoreByModel = await prisma.reasoningTestLog.groupBy({
      by: ['model'],
      _avg: {
        score: true
      },
      orderBy: {
        _avg: {
          score: 'desc'
        }
      }
    });

    console.log('\nAverage score by model:');
    console.log(scoreByModel);

    // Parse metadata for browser and device statistics
    // Get all logs with metadata
    const logsWithMetadata = await prisma.reasoningTestLog.findMany({
      select: {
        metadata: true
      }
    });

    // Parse and analyze metadata
    const browsers = {};
    const devices = {};
    
    logsWithMetadata.forEach(log => {
      if (log.metadata) {
        try {
          const metadata = JSON.parse(log.metadata);
          if (metadata.browser) {
            browsers[metadata.browser] = (browsers[metadata.browser] || 0) + 1;
          }
          if (metadata.device) {
            devices[metadata.device] = (devices[metadata.device] || 0) + 1;
          }
        } catch (e) {
          console.log('Error parsing metadata:', e);
        }
      }
    });

    console.log('\nBrowser statistics:');
    console.log(browsers);

    console.log('\nDevice statistics:');
    console.log(devices);

  } catch (error) {
    console.error('Error querying logs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch(console.error); 