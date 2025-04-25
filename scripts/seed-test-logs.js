// Script to seed test data into the ReasoningTestLog table
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Seeding test data into ReasoningTestLog table...');

    // First clear existing test data
    await prisma.reasoningTestLog.deleteMany({
      where: {
        metadata: {
          contains: '"isTestData":true'
        }
      }
    });

    // Sample data with different models and scores
    const testData = [
      {
        prompt: "How should I design a responsive navigation menu?",
        code: "<nav class=\"flex items-center justify-between flex-wrap p-6 bg-blue-500\"><div class=\"flex items-center\">...</div></nav>",
        model: "gpt-4o",
        score: 8,
        responseTime: 2350,
        metadata: JSON.stringify({
          isTestData: true,
          browser: "Chrome",
          device: "Desktop"
        })
      },
      {
        prompt: "What's the best way to implement a modal dialog?",
        code: "<div class=\"fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-black bg-opacity-50\"><div class=\"bg-white p-6 rounded-lg\">...</div></div>",
        model: "gpt-4o",
        score: 9,
        responseTime: 1987,
        metadata: JSON.stringify({
          isTestData: true,
          browser: "Firefox",
          device: "Desktop"
        })
      },
      {
        prompt: "Design a card component for a product listing",
        code: "<div class=\"rounded overflow-hidden shadow-lg p-4 bg-white\"><img class=\"w-full h-48 object-cover\">...</div>",
        model: "deepseek-coder",
        score: 7,
        responseTime: 3200,
        metadata: JSON.stringify({
          isTestData: true,
          browser: "Safari",
          device: "Mobile"
        })
      },
      {
        prompt: "How should I implement a dark mode toggle?",
        code: "function toggleDarkMode() { document.documentElement.classList.toggle('dark'); localStorage.setItem('darkMode', document.documentElement.classList.contains('dark')); }",
        model: "deepseek-coder",
        score: 6,
        responseTime: 2100,
        metadata: JSON.stringify({
          isTestData: true,
          browser: "Edge",
          device: "Tablet"
        })
      },
      {
        prompt: "Create a footer with social links",
        code: "<footer class=\"bg-gray-800 text-white p-6\"><div class=\"container mx-auto\">...</div></footer>",
        model: "gpt-4o",
        score: 7,
        responseTime: 1876,
        errorMessage: null,
        metadata: JSON.stringify({
          isTestData: true,
          browser: "Chrome",
          device: "Desktop"
        })
      }
    ];

    // Create the test records
    const createdLogs = await prisma.reasoningTestLog.createMany({
      data: testData
    });

    console.log(`Created ${createdLogs.count} test records in ReasoningTestLog table`);

    // Verify by counting logs
    const count = await prisma.reasoningTestLog.count({
      where: {
        metadata: {
          contains: '"isTestData":true'
        }
      }
    });

    console.log(`Verified ${count} test records in ReasoningTestLog table`);

  } catch (error) {
    console.error('Error seeding test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch(console.error); 