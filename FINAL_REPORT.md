# PersRM Benchmarking & Learning System – Final Report

## Overview
This system benchmarks, monitors, and continuously improves reasoning model performance using structured evaluation prompts, visual dashboards, and learning feedback loops.

## Features
- ✅ Real model integration (OpenAI, DeepSeek)
- ✅ Prompt-based benchmarking suite
- ✅ Regression detection & Markdown summaries
- ✅ Slack/Discord webhook alerts
- ✅ Notion auto-archive integration
- ✅ Visual dashboard with charts and model learning map
- ✅ Self-optimizing model routing logic
- ✅ Local LLM training pipeline (export-ready)
- ✅ GitHub Actions CI with daily benchmark runs

## Project Structure
- `/benchmark-results`: JSON + Markdown output
- `/scripts`: Automation tools (run, archive, export, etc.)
- `/local-llm-training`: Dataset generator and trainer shell
- `/src/app/dashboard/benchmark`: Visualization dashboard
- `/docs`: Notion setup, deployment, and architecture

## How to Use
1. Configure `.env` with API keys and Notion secrets
2. Run: `npm run benchmark:auto`
3. Archive results: `npm run benchmark:archive`
4. Monitor at: `/dashboard/benchmark`
5. Train local model: `cd local-llm-training && ./train.sh`

## Deployment
- GitHub Actions runs nightly + on push
- Artifacts saved per run
- Results auto-archived if Notion secrets present

## Credits
Built with ❤️ using Node.js, Recharts, Tailwind, Shadcn, Notion API, and custom LLM logic. 