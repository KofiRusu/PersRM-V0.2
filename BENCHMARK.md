# Model Benchmark System

This system allows you to benchmark different AI models for component generation tasks, measuring performance metrics like response time, code length, and success rates.

## Features

- Compare performance of different AI models (GPT-4o, GPT-3.5 Turbo, DeepSeek Chat)
- Track metrics:
  - Response time
  - Code length
  - Success rate
- Detect performance regressions
- Generate visual dashboard
- Export results to JSON and Markdown
- Webhook alerts for Slack/Discord integration
- Automated CI/CD benchmarking with GitHub Actions
- Archival to Notion database for long-term tracking

## Usage

### Dashboard UI

Visit the benchmark dashboard at: `/dashboard/benchmark`

From there you can:
- View current benchmark results
- Run new benchmarks
- See performance comparisons

### Command Line

Run benchmarks from the command line:

```bash
# Run the main benchmark
npm run benchmark:auto

# Archive benchmark results to Notion
npm run benchmark:archive
```

This will:
1. Run model benchmarks
2. Compare with previous results
3. Detect performance regressions
4. Generate a summary report
5. Send webhook alerts (if configured)

### Benchmark Reports

All benchmark results are stored in the `benchmark-results` directory:

- `model-comparison-results-*.json` - Raw benchmark data
- `benchmark-summary-*.md` - Human-readable summary with performance analysis

## Automated Performance Monitoring

The `scripts/auto-benchmark.js` script provides automated performance monitoring:

- It compares current benchmark results with the previous run
- Warns when response time increases by more than 10%
- Alerts about decreased code quality (smaller output size)
- Detects failures in previously successful tasks

This can be integrated into CI/CD pipelines for continuous model quality assurance.

## Webhook Alerts

The benchmark system can send alerts to Slack or Discord when benchmarks complete:

1. Add your webhook URL to your `.env` file:
   ```
   BENCHMARK_ALERT_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz
   ```
   
2. Run the benchmark as usual with `npm run benchmark:auto`

3. Receive alerts with:
   - Summary of models tested
   - Performance regressions detected
   - Model changes (additions/removals)
   - Link to the full report

This is useful for team notifications and continuous monitoring.

## Notion Integration

Benchmark results can be automatically archived to a Notion database for long-term tracking and analysis:

1. Create a Notion integration and database:
   - Go to [Notion Integrations](https://www.notion.so/my-integrations)
   - Create a new integration with the "Read & Write" capability
   - Create a database in Notion with the following properties:
     - Prompt (Title)
     - Model (Text)
     - ResponseTime (Number)
     - CodeLength (Number)
     - Success (Checkbox)
     - BestModel (Checkbox)
     - Date (Date)
     - Error (Text)
     - File (Text)
     - Notes (Text)
   - Share the database with your integration

2. Add Notion credentials to your `.env` file:
   ```
   NOTION_TOKEN=your_notion_integration_secret
   NOTION_DATABASE_ID=your_notion_database_id
   ```

3. Run the archival script:
   ```bash
   npm run benchmark:archive
   ```

4. Access your Notion database to view all archived benchmark results with filtering and sorting capabilities.

## GitHub Actions Integration

The repository includes a GitHub Actions workflow that automatically runs benchmarks:

1. On a schedule (nightly at 3AM UTC)
2. On every push to the main branch

Setup requirements:

1. Add the following secrets to your GitHub repository settings:
   - `BENCHMARK_ALERT_WEBHOOK_URL` - For Slack/Discord notifications
   - `OPENAI_API_KEY` - For GPT model access
   - `DEEPSEEK_API_KEY` - For DeepSeek model access
   - `NOTION_TOKEN` - For archiving to Notion
   - `NOTION_DATABASE_ID` - For archiving to Notion

2. Benchmark results are available as artifacts in the GitHub Actions workflow.

To view benchmark results:
1. Go to the Actions tab in GitHub
2. Select the completed benchmark workflow run
3. Download the benchmark-results artifact

## Extending the Benchmark

To add new models or prompts to benchmark:

1. Edit `benchmarks/prompts.json` to add new test prompts
2. Configure API keys in `.env` for any additional models
3. Run the benchmark to compare

## Troubleshooting

If you encounter port conflicts when running the benchmark server, edit the port in:
`src/app/api/benchmarks/run/route.ts` 