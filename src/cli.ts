#!/usr/bin/env node

/**
 * CLI entry point for Claude Insights Toolkit
 *
 * Commands:
 * - collect: Collect insights from ~/.claude/usage-data/facets/
 * - analyze: Detect bottleneck patterns
 * - suggest: Generate CLAUDE.md improvements
 * - trend: Show productivity trends
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

// Import collectors
import { collectFacets, loadStoredData, getAvailableDates } from './collectors/facets';

// Import analyzers
import { analyzeBottlenecks, getHighSeveritySessions } from './analyzers/bottleneck';
import { analyzeTrends, formatTrendChart } from './analyzers/trends';

// Import generators
import { generateClaudeMdSuggestions, formatSuggestionsAsMarkdown, generateSuggestionSummary } from './generators/claude-md';

import * as fs from 'fs/promises';
import * as path from 'path';

const program = new Command();

program
  .name('cit')
  .description('Claude Insights Toolkit - Analyze and optimize your Claude Code workflow')
  .version('0.1.0');

/**
 * Collect command - Gather insights data from Claude Code
 */
program
  .command('collect')
  .description('Collect insights from ~/.claude/usage-data/facets/')
  .option('-d, --date <YYYY-MM-DD>', 'Specific date to collect')
  .option('-a, --all', 'Collect all available historical data')
  .option('-o, --output <path>', 'Output path for collected data')
  .action(async (options) => {
    const spinner = ora('Collecting insights data...').start();

    try {
      const result = await collectFacets({
        date: options.date,
        collectAll: options.all,
        outputPath: options.output,
      });

      spinner.succeed(chalk.green('Insights data collected successfully'));

      console.log(chalk.blue('\nCollection Summary:'));
      console.log(`  • Sessions collected: ${chalk.bold(result.sessionsCollected)}`);
      console.log(`  • Dates processed: ${chalk.bold(result.datesProcessed.join(', ') || 'none')}`);
      console.log(`  • Storage location: ${chalk.bold(result.storagePath)}`);
      if (result.reportCopied && result.reportPath) {
        console.log(`  • Report saved: ${chalk.bold(path.relative(process.cwd(), result.reportPath))}`);
      }
    } catch (error) {
      spinner.fail(chalk.red('Failed to collect insights'));
      if (error instanceof Error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
      process.exit(1);
    }
  });

/**
 * Analyze command - Detect bottleneck patterns
 */
program
  .command('analyze')
  .description('Detect bottleneck patterns in your workflow')
  .option('-d, --days <number>', 'Number of days to analyze', '7')
  .option('-f, --feature <keyword>', 'Analyze specific feature by keyword')
  .option('-o, --output <format>', 'Output format (json|text)', 'text')
  .option('-v, --verbose', 'Show detailed analysis')
  .action(async (options) => {
    const spinner = ora('Analyzing bottlenecks...').start();

    try {
      const data = await loadStoredData({ days: parseInt(options.days) });

      if (data.length === 0) {
        spinner.warn(chalk.yellow('No data found. Run `cit collect` first.'));
        return;
      }

      const analysis = analyzeBottlenecks(data);
      spinner.succeed(chalk.green('Analysis complete'));

      console.log(chalk.bold('\n🔍 Bottleneck Analysis'));
      console.log(chalk.gray('━'.repeat(50)));

      console.log('\n📊 METRICS:');
      console.log(`  • Total sessions: ${chalk.bold(analysis.metrics.totalSessions)}`);
      console.log(`  • Success rate: ${chalk.bold(analysis.metrics.successRate + '%')}`);
      console.log(`  • API blocked: ${chalk.bold(analysis.metrics.apiBlockedRate + '%')}`);
      console.log(`  • Wrong approach: ${chalk.bold(analysis.metrics.wrongApproachRate + '%')}`);

      if (analysis.patterns.length > 0) {
        console.log('\n⚠️  DETECTED PATTERNS:');
        analysis.patterns.forEach(p => {
          const icon = p.severity === 'critical' ? '🔴' :
                       p.severity === 'high' ? '🟠' :
                       p.severity === 'medium' ? '🟡' : '🟢';
          console.log(`  ${icon} ${p.pattern}: ${p.affectedPercentage}% (${p.affectedCount} sessions)`);
          if (options.verbose) {
            console.log(`     ${chalk.gray(p.description)}`);
          }
        });
      }

      if (analysis.recommendations.length > 0) {
        console.log('\n💡 RECOMMENDATIONS:');
        analysis.recommendations.forEach((r, i) => {
          console.log(`  ${i + 1}. ${r}`);
        });
      }

      if (options.verbose) {
        console.log('\n🔥 HIGH SEVERITY SESSIONS:');
        const highSeverity = getHighSeveritySessions(data, 5);
        highSeverity.forEach(s => {
          console.log(`  [${s.severityScore}] ${s.goal.slice(0, 60)}...`);
        });
      }

      console.log(chalk.blue('\n✨ Run \'cit suggest\' to auto-generate CLAUDE.md updates'));

      if (options.output === 'json') {
        console.log('\n' + JSON.stringify(analysis, null, 2));
      }
    } catch (error) {
      spinner.fail(chalk.red('Analysis failed'));
      if (error instanceof Error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
      process.exit(1);
    }
  });

/**
 * Suggest command - Generate CLAUDE.md improvements
 */
program
  .command('suggest')
  .description('Generate CLAUDE.md improvement suggestions')
  .option('-d, --days <number>', 'Days of data to analyze', '7')
  .option('-o, --output <path>', 'Output file path')
  .option('-a, --append', 'Append to existing CLAUDE.md')
  .action(async (options) => {
    const spinner = ora('Generating suggestions...').start();

    try {
      const data = await loadStoredData({ days: parseInt(options.days) });

      if (data.length === 0) {
        spinner.warn(chalk.yellow('No data found. Run `cit collect` first.'));
        return;
      }

      const analysis = analyzeBottlenecks(data);
      const suggestions = generateClaudeMdSuggestions(analysis);

      spinner.succeed(chalk.green('Suggestions generated'));

      console.log(generateSuggestionSummary(suggestions));

      if (options.output) {
        const markdown = formatSuggestionsAsMarkdown(suggestions);

        if (options.append) {
          const existing = await fs.readFile(options.output, 'utf-8').catch(() => '');
          await fs.writeFile(options.output, existing + '\n\n' + markdown);
        } else {
          await fs.writeFile(options.output, markdown);
        }

        console.log(chalk.blue(`\n✅ Suggestions written to: ${options.output}`));
      } else {
        console.log(chalk.bold('\n📝 CLAUDE.md Suggestions Preview:'));
        console.log(chalk.gray('━'.repeat(50)));
        console.log(formatSuggestionsAsMarkdown(suggestions));
      }
    } catch (error) {
      spinner.fail(chalk.red('Suggestion generation failed'));
      if (error instanceof Error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
      process.exit(1);
    }
  });

/**
 * Trend command - Show productivity trends
 */
program
  .command('trend')
  .description('Show productivity trends over time')
  .option('-d, --days <number>', 'Number of days to analyze', '30')
  .option('-m, --metric <type>', 'Metric to highlight', 'success')
  .option('-o, --output <format>', 'Output format (text|json)', 'text')
  .action(async (options) => {
    const spinner = ora('Analyzing trends...').start();

    try {
      const data = await loadStoredData({ days: parseInt(options.days) });

      if (data.length === 0) {
        spinner.warn(chalk.yellow('No data found. Run `cit collect` first.'));
        return;
      }

      const trends = analyzeTrends(data);
      spinner.succeed(chalk.green('Trend analysis complete'));

      console.log(chalk.bold('\n📊 Productivity Trends'));
      console.log(chalk.gray('━'.repeat(50)));
      console.log(`Period: ${trends.dateRange.start} to ${trends.dateRange.end}\n`);

      // Display each trend
      trends.trends.forEach(t => {
        console.log(formatTrendChart(t));
        console.log(chalk.italic(t.insight) + '\n');
      });

      if (trends.insights.length > 0) {
        console.log(chalk.bold('💡 INSIGHTS:'));
        trends.insights.forEach(i => console.log(`  ${i}`));
      }

      if (options.output === 'json') {
        console.log('\n' + JSON.stringify(trends, null, 2));
      }
    } catch (error) {
      spinner.fail(chalk.red('Trend analysis failed'));
      if (error instanceof Error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
      process.exit(1);
    }
  });

/**
 * Status command - Quick overview
 */
program
  .command('status')
  .description('Show quick status of collected data')
  .action(async () => {
    try {
      const dates = await getAvailableDates();

      console.log(chalk.bold('\n📈 Claude Insights Status'));
      console.log(chalk.gray('━'.repeat(40)));
      console.log(`  • Stored days: ${chalk.bold(dates.length)}`);

      if (dates.length > 0) {
        console.log(`  • Latest: ${chalk.bold(dates[0])}`);
        console.log(`  • Oldest: ${chalk.bold(dates[dates.length - 1])}`);

        // Quick metrics from latest day
        const data = await loadStoredData({ days: 1 });
        if (data.length > 0) {
          const today = data[0];
          console.log(`  • Sessions today: ${chalk.bold(today.sessions.length)}`);
        }
      } else {
        console.log(chalk.yellow('\n  No data collected yet. Run `cit collect` to start.'));
      }
    } catch (error) {
      console.error(chalk.red('Failed to get status'));
      process.exit(1);
    }
  });

/**
 * Report command - List or open saved insight reports
 */
program
  .command('report')
  .description('List or open saved insight reports')
  .option('-d, --date <YYYY-MM-DD>', 'Open specific date report')
  .option('-l, --list', 'List all saved reports')
  .action(async (options) => {
    const { homedir } = require('os');
    const reportsPath = path.join(homedir(), 'claude-insights', 'reports');

    try {
      if (options.list || !options.date) {
        // List all saved reports
        const files = await fs.readdir(reportsPath).catch(() => []);
        const reports = files.filter(f => f.endsWith('.html')).sort().reverse();

        if (reports.length === 0) {
          console.log(chalk.yellow('No reports found. Run /insights first.'));
          return;
        }

        console.log(chalk.bold('\n📄 Saved Insight Reports'));
        console.log(chalk.gray('━'.repeat(40)));
        reports.forEach(r => {
          const date = r.replace('report-', '').replace('.html', '');
          console.log(`  ${date}  →  ${path.join(reportsPath, r)}`);
        });
        console.log(chalk.blue(`\nOpen with: cit report -d YYYY-MM-DD`));
      } else {
        // Open specific date report
        const reportFile = path.join(reportsPath, `report-${options.date}.html`);
        try {
          await fs.access(reportFile);
          // macOS open command
          const { exec } = require('child_process');
          exec(`open "${reportFile}"`);
          console.log(chalk.green(`Opening report for ${options.date}...`));
        } catch {
          console.log(chalk.red(`No report found for ${options.date}`));
        }
      }
    } catch (error) {
      console.error(chalk.red('Failed to access reports'));
      if (error instanceof Error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
      process.exit(1);
    }
  });

// Parse CLI arguments
program.parse();
