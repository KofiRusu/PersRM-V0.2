.command('score')
.description('Score components based on prompt fidelity and quality')
.option('-i, --input <directory>', 'Directory containing prompt files')
.option('-o, --output <directory>', 'Directory to store generated components')
.option('-a, --analysis <directory>', 'Directory to store analysis reports')
.option('-s, --self-improve', 'Enable self-improvement strategies', false)
.option('-d, --discover', 'Enable automatic strategy discovery', false)
.option('-v, --verbose', 'Show detailed output', false)
.action(async (options: {
  input: string;
  output: string;
  analysis: string;
  selfImprove: boolean;
  discover: boolean;
  verbose: boolean;
}) => {
  // ... existing code ...
  
  // When setting up the SelfTrainer, pass the discover flag
  if (options.selfImprove) {
    // Initialize the SelfTrainer with the discover flag
    const selfTrainer = new SelfTrainer(
      agent,
      defaultStrategies,
      {
        memory,
        verbose: options.verbose,
        enableStrategyDiscovery: options.discover
      }
    );
    
    // ... existing code ...
  }
  
  // ... existing code ...
}); 