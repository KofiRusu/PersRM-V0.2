import fs from 'fs';
import path from 'path';
import { openai } from '../src/lib/openai';

// Define the dataset structure
interface ReasoningExample {
  input: string;
  expected_reasoning: string;
}

// UI/UX scenarios to generate reasoning for
const scenarios = [
  "Should I use a modal or a drawer for a form that collects user information?",
  "When should I use infinite scroll vs pagination for a product listing?",
  "What's the best navigation pattern for a mobile app with 5 main sections?",
  "How should I design error states for form validation?",
  "What's the best way to indicate loading states in a dashboard?",
  "Should I use tabs or accordion for content organization in a settings page?",
  "What's the optimal approach for implementing multi-step forms?",
  "How should I design an onboarding flow for a new user?",
  "What's the best way to handle permissions and restricted UI elements?",
  "Should I use cards or tables to display user data in an admin panel?",
  "What are the best practices for designing a search interface?",
  "How should I design a color system for a financial application?",
  "What's the most accessible way to implement a dropdown menu?",
  "How should I handle state transitions in a multi-page wizard?",
  "What's the best way to present complex data visualization options to users?"
];

async function generateReasoningExample(prompt: string): Promise<ReasoningExample> {
  console.log(`Generating reasoning for: ${prompt}`);
  
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `You are an expert UI/UX designer and front-end developer. 
          Generate thoughtful, detailed reasoning about the following UI/UX question.
          Your reasoning should consider:
          - User experience principles
          - Accessibility
          - Performance implications
          - Mobile vs desktop considerations
          - Current best practices
          - Implementation complexity
          
          Provide a comprehensive and nuanced analysis with clear recommendations.`
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
    });

    const reasoning = completion.choices[0].message.content?.trim() || "";
    
    return {
      input: prompt,
      expected_reasoning: reasoning
    };
  } catch (error) {
    console.error(`Error generating reasoning for "${prompt}":`, error);
    return {
      input: prompt,
      expected_reasoning: "Error generating reasoning."
    };
  }
}

async function generateDataset() {
  const examples: ReasoningExample[] = [];
  
  for (const scenario of scenarios) {
    const example = await generateReasoningExample(scenario);
    examples.push(example);
    
    // Add a small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Write to JSONL file
  const outputDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = path.join(outputDir, 'reasoning-dataset.jsonl');
  const fileStream = fs.createWriteStream(outputPath);
  
  for (const example of examples) {
    fileStream.write(JSON.stringify(example) + '\n');
  }
  
  fileStream.end();
  console.log(`Dataset generated with ${examples.length} examples at ${outputPath}`);
}

// Execute the generation
generateDataset().catch(console.error); 