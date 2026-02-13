#!/usr/bin/env node

/**
 * CLI entry point for Claude Insights Toolkit
 *
 * Commands:
 * - collect: Collect insights from ~/.claude/usage-data/facets/
 * - analyze: Detect bottleneck patterns
 * - suggest: Generate CLAUDE.md improvements
 * - trend: Show productivity trends
 * - compare: Compare insights between two dates
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

// Import collectors
import { collectFacets, loadStoredData, getAvailableDates } from './collectors/facets';

// Import analyzers
import { analyzeBottlenecks, getHighSeveritySessions } from './analyzers/bottleneck';
import { analyzeTrends, formatTrendChart } from './analyzers/trends';
import { compareInsights, formatCompareResult } from './analyzers/compare';

// Import sync commands
import { sync, pull, push, addRemote, removeRemote, listRemotes, getDeviceId } from './commands/sync';

// Import generators
import { generateClaudeMdSuggestions, formatSuggestionsAsMarkdown, generateSuggestionSummary } from './generators/claude-md';
import { generateAdvancedAdvisories, formatAdvisoriesAsMarkdown, generateAdvisorySummary } from './generators/claude-md-advanced';

// Import parsers
import { loadLatestReport } from './parsers/report-html';
import { loadAllSnapshots } from './collectors/snapshot';

// Import profile
import { generateProfile, formatProfileText } from './analyzers/profile';

// Import dashboard
import { startDashboard } from './commands/dashboard';

// Import setup and daemon
import { runSetup } from './commands/setup';
import { runHealthCheck } from './commands/health';
import { handleDaemonCommand, DaemonAction } from './commands/daemon';

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
  .option('--mode <full|light>', 'Collection mode (default: full)', 'full')
  .action(async (options) => {
    const spinner = ora('Collecting insights data...').start();

    try {
      const result = await collectFacets({
        date: options.date,
        collectAll: options.all,
        outputPath: options.output,
        mode: options.mode,
      });

      spinner.succeed(chalk.green('Insights data collected successfully'));

      console.log(chalk.blue('\nCollection Summary:'));
      console.log(`  • Sessions collected: ${chalk.bold(result.sessionsCollected)}`);
      console.log(`  • Dates processed: ${chalk.bold(result.datesProcessed.join(', ') || 'none')}`);
      console.log(`  • Storage location: ${chalk.bold(result.storagePath)}`);
      if (result.reportCopied && result.reportPath) {
        console.log(`  • Report saved: ${chalk.bold(path.relative(process.cwd(), result.reportPath))}`);
      }
      if (result.snapshotCreated && result.snapshotPath) {
        console.log(`  • Snapshot saved: ${chalk.bold(path.basename(result.snapshotPath))}`);
      }
      if (result.skipped && result.skipReason) {
        console.log(`  • Collection status: ${chalk.yellow('skipped')} (${result.skipReason})`);
      }
      if (result.estimatedCostKpi) {
        console.log(`  • Estimated tokens: ${chalk.bold(result.estimatedCostKpi.estimatedTokens.toLocaleString())} ${chalk.gray('(estimate)')}`);
        console.log(`  • Estimated cost: ${chalk.bold(`$${result.estimatedCostKpi.estimatedCostUsd.toFixed(4)}`)} ${chalk.gray(`(estimate, model: ${result.estimatedCostKpi.estimationModel})`)}`);
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

/**
 * Compare command - Compare insights between two dates
 */
program
  .command('compare')
  .description('Compare insights between two dates')
  .requiredOption('-d1, --date1 <YYYY-MM-DD>', 'First date to compare')
  .requiredOption('-d2, --date2 <YYYY-MM-DD>', 'Second date to compare')
  .option('-o, --output <format>', 'Output format (text|json)', 'text')
  .action(async (options) => {
    const spinner = ora('Comparing insights...').start();

    try {
      const result = await compareInsights(options.date1, options.date2);
      spinner.succeed(chalk.green('Comparison complete'));

      if (options.output === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatCompareResult(result));
      }
    } catch (error) {
      spinner.fail(chalk.red('Comparison failed'));
      if (error instanceof Error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
      process.exit(1);
    }
  });

/**
 * Sync command - Sync insights data across devices via Git
 */
program
  .command('sync')
  .description('Sync insights data across devices (commit + pull + push)')
  .action(async () => {
    const spinner = ora('Syncing insights data...').start();

    try {
      const result = await sync();

      if (result.error) {
        spinner.fail(chalk.red('Sync failed'));
        console.error(chalk.red(`[${result.error.errorCode}] ${result.error.message}`));
        console.log(chalk.yellow(`Action: ${result.error.actionHint}`));

        if (result.error.errorCode === 'NO_REMOTE') {
          console.log(chalk.gray('Hint: configure with `cit remote add <url>`.'));
        } else if (result.error.errorCode === 'PULL_CONFLICT') {
          console.log(chalk.gray('Hint: inspect conflicts with `git -C ~/claude-insights status`.'));
        } else if (result.error.errorCode === 'PUSH_REJECTED') {
          console.log(chalk.gray('Hint: pull latest changes before pushing again.'));
        } else if (result.error.errorCode === 'AUTH') {
          console.log(chalk.gray('Hint: re-authenticate Git/GitHub credentials.'));
        }

        process.exit(1);
      }

      spinner.succeed(chalk.green('Sync complete'));
      console.log(chalk.blue('\nSync Summary:'));
      console.log(`  • Device: ${chalk.bold(getDeviceId())}`);
      console.log(`  • Committed: ${result.committed ? chalk.green('yes') : 'no changes'}`);
      console.log(`  • Pulled: ${result.pulled ? chalk.green('yes') : 'no'}`);
      console.log(`  • Pushed: ${result.pushed ? chalk.green('yes') : 'no'}`);
    } catch (error) {
      spinner.fail(chalk.red('Sync failed'));
      if (error instanceof Error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
      process.exit(1);
    }
  });

/**
 * Pull command - Download data from remote
 */
program
  .command('pull')
  .description('Pull insights data from remote repository')
  .action(async () => {
    const spinner = ora('Pulling from remote...').start();

    try {
      const result = await pull();
      if (result.success) {
        spinner.succeed(chalk.green('Pull complete'));
      } else {
        spinner.fail(chalk.red('Pull failed: ' + result.error));
        process.exit(1);
      }
    } catch (error) {
      spinner.fail(chalk.red('Pull failed'));
      process.exit(1);
    }
  });

/**
 * Push command - Upload data to remote
 */
program
  .command('push')
  .description('Push insights data to remote repository')
  .action(async () => {
    const spinner = ora('Pushing to remote...').start();

    try {
      const result = await push();
      if (result.success) {
        spinner.succeed(chalk.green('Push complete'));
      } else {
        spinner.fail(chalk.red('Push failed: ' + result.error));
        process.exit(1);
      }
    } catch (error) {
      spinner.fail(chalk.red('Push failed'));
      process.exit(1);
    }
  });

/**
 * Remote command - Manage remote repository
 */
const remoteCmd = program
  .command('remote')
  .description('Manage remote repository for sync');

remoteCmd
  .command('add <url>')
  .description('Add or update remote repository URL')
  .action(async (url: string) => {
    try {
      await addRemote(url);
      console.log(chalk.green(`✅ Remote set to: ${url}`));
      console.log(chalk.blue('\nNext steps:'));
      console.log('  1. Run: cit sync');
      console.log('  2. On other devices: git clone <url> ~/claude-insights && cit sync');
    } catch (error) {
      console.error(chalk.red('Failed to add remote'));
      process.exit(1);
    }
  });

remoteCmd
  .command('remove')
  .description('Remove remote repository')
  .action(async () => {
    try {
      await removeRemote();
      console.log(chalk.green('✅ Remote removed'));
    } catch (error) {
      console.error(chalk.red('Failed to remove remote'));
      process.exit(1);
    }
  });

remoteCmd
  .command('list')
  .description('List configured remotes')
  .action(async () => {
    try {
      const remotes = await listRemotes();
      if (remotes.length === 0) {
        console.log(chalk.yellow('No remotes configured.'));
        console.log(chalk.blue('Add one with: cit remote add <github-url>'));
      } else {
        console.log(chalk.bold('\n🔗 Configured Remotes'));
        remotes.forEach(r => {
          console.log(`  ${r.name}: ${r.url}`);
        });
      }
    } catch (error) {
      console.error(chalk.red('Failed to list remotes'));
      process.exit(1);
    }
  });

/**
 * Init-sync command - Initialize sync with auto-created private repo
 */
program
  .command('init-sync')
  .description('Initialize sync by creating a private GitHub repo')
  .option('-n, --name <repo-name>', 'Repository name', 'claude-insights-data')
  .action(async (options) => {
    const spinner = ora('Initializing sync...').start();

    // Import dynamically to get new functions
    const { initSync } = await import('./commands/sync');

    try {
      const result = await initSync(options.name);

      if (result.success) {
        spinner.succeed(chalk.green('Sync initialized successfully!'));
        console.log(chalk.blue('\nSetup Summary:'));
        result.steps.forEach(step => console.log(`  ${step}`));
        console.log(chalk.bold(`\n📦 Repository: ${result.repoUrl}`));
        console.log(chalk.blue('\nNext steps:'));
        console.log('  • Run: cit collect --all  (gather all historical data)');
        console.log('  • Run: cit sync           (sync after each session)');
        console.log(chalk.gray('\nOn a new computer:'));
        console.log(`  • Run: cit clone ${result.repoUrl}`);
      } else {
        spinner.fail(chalk.red('Init failed'));
        console.error(chalk.red(`Error: ${result.error}`));
        if (result.steps.length > 0) {
          console.log(chalk.blue('\nCompleted steps:'));
          result.steps.forEach(step => console.log(`  ${step}`));
        }
        process.exit(1);
      }
    } catch (error) {
      spinner.fail(chalk.red('Init failed'));
      if (error instanceof Error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
      process.exit(1);
    }
  });

/**
 * Clone command - Clone insights data on a new computer
 */
program
  .command('clone <repo-url>')
  .description('Clone insights data from GitHub to a new computer')
  .action(async (repoUrl: string) => {
    const spinner = ora('Cloning insights data...').start();

    // Import dynamically
    const { cloneInsights } = await import('./commands/sync');

    try {
      const result = await cloneInsights(repoUrl);

      if (result.success) {
        spinner.succeed(chalk.green('Clone complete!'));
        console.log(chalk.blue('\nInsights data restored to: ~/claude-insights/'));
        console.log(chalk.blue('\nNext steps:'));
        console.log('  • Run: cit status         (verify data)');
        console.log('  • Run: cit dashboard      (view dashboard)');
        console.log('  • Run: cit sync           (keep in sync)');
      } else {
        spinner.fail(chalk.red('Clone failed'));
        console.error(chalk.red(`Error: ${result.error}`));
        process.exit(1);
      }
    } catch (error) {
      spinner.fail(chalk.red('Clone failed'));
      if (error instanceof Error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
      process.exit(1);
    }
  });

/**
 * History command - View snapshot history
 */
program
  .command('history')
  .description('View snapshot history and track usage trends')
  .option('-l, --last <number>', 'Show last N snapshots', '10')
  .option('-o, --output <format>', 'Output format (text|json)', 'text')
  .action(async (options) => {
    const spinner = ora('Loading snapshot history...').start();

    try {
      const snapshots = await loadAllSnapshots();

      if (snapshots.length === 0) {
        spinner.warn(chalk.yellow('No snapshots found. Run `cit collect` first.'));
        return;
      }

      spinner.succeed(chalk.green(`Found ${snapshots.length} snapshots`));

      const limit = parseInt(options.last);
      const display = snapshots.slice(-limit).reverse();

      if (options.output === 'json') {
        console.log(JSON.stringify(display, null, 2));
        return;
      }

      console.log(chalk.bold('\n📸 Snapshot History'));
      console.log(chalk.gray('━'.repeat(90)));

      // Header
      console.log(
        chalk.gray(
          '  Date        │ Sessions │ Success │ Language    │ Anomalies'
        )
      );
      console.log(chalk.gray('  ' + '─'.repeat(86)));

      // Rows
      for (const snap of display) {
        const m = snap.metrics;
        const anomalyCount = snap.delta?.anomalies.length || 0;
        const hasCritical = snap.delta?.anomalies.some(a => a.severity === 'critical') || false;

        const anomalyStr = anomalyCount === 0
          ? chalk.green('none')
          : hasCritical
            ? chalk.red(`${anomalyCount} (CRITICAL)`)
            : chalk.yellow(`${anomalyCount} warning(s)`);

        const successStr = m.successRate >= 80
          ? chalk.green(`${m.successRate}%`)
          : m.successRate >= 60
            ? chalk.yellow(`${m.successRate}%`)
            : chalk.red(`${m.successRate}%`);

        console.log(
          `  ${snap.date}  │ ${String(m.sessions).padStart(8)} │ ${String(successStr).padStart(7 + 10)} │ ${m.primaryLanguage.padEnd(11)} │ ${anomalyStr}`
        );
      }

      // Summary
      const first = snapshots[0];
      const last = snapshots[snapshots.length - 1];
      console.log(chalk.gray('\n  ' + '─'.repeat(86)));
      console.log(`  Period: ${chalk.bold(first.date)} → ${chalk.bold(last.date)} (${chalk.bold(snapshots.length)} snapshots)`);
      const latestCostKpi = display[0]?.metrics.costKpi;
      if (latestCostKpi) {
        console.log(`  Latest estimated tokens: ${chalk.bold(latestCostKpi.estimatedTokens.toLocaleString())} ${chalk.gray('(estimate)')}`);
        console.log(`  Latest estimated cost: ${chalk.bold(`$${latestCostKpi.estimatedCostUsd.toFixed(4)}`)} ${chalk.gray(`(estimate, model: ${latestCostKpi.estimationModel})`)}`);
      } else {
        console.log(`  Latest estimated cost: ${chalk.gray('not available (estimate)')}`);
      }

      // Show anomalies if any recent ones
      const recentAnomalies = display
        .filter(s => s.delta && s.delta.anomalies.length > 0)
        .slice(0, 3);

      if (recentAnomalies.length > 0) {
        console.log(chalk.bold('\n⚠️  Recent Anomalies:'));
        for (const snap of recentAnomalies) {
          for (const anomaly of snap.delta!.anomalies) {
            const icon = anomaly.severity === 'critical' ? '🔴' : '🟡';
            console.log(`  ${icon} [${snap.date}] ${anomaly.message}`);
          }
        }
      }
    } catch (error) {
      spinner.fail(chalk.red('Failed to load history'));
      if (error instanceof Error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
      process.exit(1);
    }
  });

/**
 * Profile command - Generate your Claude Code coding style profile
 */
program
  .command('profile')
  .description('Generate your Claude Code coding style profile')
  .option('-o, --output <format>', 'Output format (text|json)', 'text')
  .option('-s, --save <path>', 'Save profile to file')
  .action(async (options) => {
    const spinner = ora('Generating your coding profile...').start();

    try {
      // Load report.html data
      const reportData = await loadLatestReport();

      if (!reportData) {
        spinner.fail(chalk.red('No report.html found.'));
        console.log(chalk.yellow('\nTo generate a report:'));
        console.log('  1. Run /insights in your Claude Code session');
        console.log('  2. Then run: cit collect');
        console.log(chalk.gray('\nReport locations checked:'));
        console.log('  • ~/claude-insights/reports/report-*.html');
        console.log('  • ~/.claude/usage-data/report.html');
        process.exit(1);
      }

      // Optionally load facets data for enrichment
      let facetsData;
      try {
        facetsData = await loadStoredData({ days: 30 });
      } catch {
        // No facets data available, that's fine
      }

      const profile = generateProfile(reportData, facetsData);
      spinner.succeed(chalk.green('Profile generated'));

      if (options.output === 'json') {
        const jsonOutput = JSON.stringify(profile, null, 2);
        if (options.save) {
          await fs.writeFile(options.save, jsonOutput);
          console.log(chalk.blue(`\n✅ Profile saved to: ${options.save}`));
        } else {
          console.log(jsonOutput);
        }
      } else {
        const textOutput = formatProfileText(profile);
        if (options.save) {
          await fs.writeFile(options.save, textOutput);
          console.log(chalk.blue(`\n✅ Profile saved to: ${options.save}`));
        } else {
          console.log('\n' + textOutput);
        }
      }
    } catch (error) {
      spinner.fail(chalk.red('Profile generation failed'));
      if (error instanceof Error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
      process.exit(1);
    }
  });

/**
 * Setup command - Auto-configure data collection
 */
program
  .command('setup')
  .description('Auto-configure data collection (hooks, directories, settings)')
  .action(async () => {
    const spinner = ora('Running setup...').start();

    try {
      const result = await runSetup();

      if (result.success && result.warnings.length === 0) {
        spinner.succeed(chalk.green('Setup complete'));
      } else {
        spinner.warn(chalk.yellow('Setup completed with warnings'));
      }

      console.log(chalk.blue('\nSetup Steps:'));
      result.steps.forEach(step => {
        console.log(`  ${chalk.green('✓')} ${step}`);
      });

      if (result.warnings.length > 0) {
        console.log(chalk.yellow('\nWarnings:'));
        result.warnings.forEach(warn => {
          console.log(`  ${chalk.yellow('!')} ${warn}`);
        });
      }

      if (result.errors.length > 0) {
        console.log(chalk.red('\nErrors:'));
        result.errors.forEach(err => {
          console.log(`  ${chalk.red('✗')} ${err}`);
        });
      }

      console.log(chalk.blue('\nNext steps:'));
      console.log('  • Hook path (default): auto full collection runs after each Claude session');
      console.log('  • Run: cit collect --all  (gather historical data)');
      console.log('  • Run: cit daemon start   (optional realtime monitoring, light mode)');
    } catch (error) {
      spinner.fail(chalk.red('Setup failed'));
      if (error instanceof Error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
      process.exit(1);
    }
  });

/**
 * Daemon command - Manage the auto-collection daemon
 */
program
  .command('health')
  .description('Run health checks for collection and sync prerequisites')
  .action(async () => {
    const result = await runHealthCheck();

    console.log(chalk.bold('\n🏥 Claude Insights Health'));
    console.log(chalk.gray('━'.repeat(50)));

    for (const check of result.checks) {
      const color = check.status === 'PASS' ? chalk.green : check.status === 'WARN' ? chalk.yellow : chalk.red;
      console.log(`  ${color(check.status.padEnd(4))} ${check.name}: ${check.details}`);
    }

    console.log(chalk.blue(`\nOverall: ${result.status}`));
    if (result.status === 'FAIL') {
      process.exit(1);
    }
  });

program
  .command('daemon')
  .description('Manage the auto-collection file watcher daemon')
  .argument('<action>', 'start, stop, or status')
  .action(async (action: string) => {
    if (!['start', 'stop', 'status'].includes(action)) {
      console.error(chalk.red(`Unknown action: ${action}`));
      console.log('Usage: cit daemon <start|stop|status>');
      process.exit(1);
    }

    try {
      await handleDaemonCommand(action as DaemonAction);
    } catch (error) {
      console.error(chalk.red('Daemon command failed'));
      if (error instanceof Error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
      process.exit(1);
    }
  });

/**
 * Patterns command - Extract and display workflow patterns
 */
program
  .command('patterns')
  .description('Extract successful workflow patterns from your sessions')
  .option('-d, --days <number>', 'Number of days to analyze', '30')
  .option('-g, --goal <keyword>', 'Find patterns for specific goal')
  .option('-o, --output <format>', 'Output format (text|json)', 'text')
  .action(async (options) => {
    const spinner = ora('Extracting patterns...').start();

    try {
      const { extractPatterns, getRecommendedPatterns } = await import('./analyzers/pattern-extractor');
      const data = await loadStoredData({ days: parseInt(options.days) });

      if (data.length === 0) {
        spinner.warn(chalk.yellow('No data found. Run `cit collect` first.'));
        return;
      }

      const result = extractPatterns(data);
      spinner.succeed(chalk.green('Patterns extracted'));

      if (options.goal) {
        const matches = getRecommendedPatterns(options.goal, result.patterns);
        console.log(chalk.bold(`\n🔍 Patterns for "${options.goal}"`));
        console.log(chalk.gray('━'.repeat(50)));

        if (matches.length === 0) {
          console.log(chalk.yellow('No matching patterns found.'));
        } else {
          matches.slice(0, 5).forEach((match, i) => {
            const p = match.pattern;
            console.log(`\n  ${i + 1}. ${chalk.bold(p.name)} ${chalk.gray(`(${match.relevanceScore}% match)`)}`);
            console.log(`     ${p.description}`);
            console.log(`     Success rate: ${chalk.green(p.successRate + '%')} | Confidence: ${chalk.blue(Math.round(p.confidence * 100) + '%')}`);
            console.log(`     Why: ${match.matchReason}`);
          });
        }
      } else {
        console.log(chalk.bold('\n📊 Pattern Extraction Results'));
        console.log(chalk.gray('━'.repeat(50)));
        console.log(`\n  Total patterns: ${chalk.bold(result.statistics.totalPatterns)}`);
        console.log(`  High confidence: ${chalk.bold(result.statistics.highConfidencePatterns)}`);
        console.log(`  Overall success rate: ${chalk.bold(result.statistics.overallSuccessRate + '%')}`);

        if (result.topPatterns.length > 0) {
          console.log(chalk.bold('\n🏆 Top Patterns:'));
          result.topPatterns.slice(0, 5).forEach((p, i) => {
            console.log(`  ${i + 1}. ${p.name} ${chalk.gray(`(${p.effectivenessScore} effectiveness)`)}`);
          });
        }

        if (result.insights.length > 0) {
          console.log(chalk.bold('\n💡 Insights:'));
          result.insights.slice(0, 3).forEach(insight => {
            const icon = insight.type === 'success_factor' ? '✓' :
                         insight.type === 'avoidance' ? '⚠' :
                         insight.type === 'correlation' ? '↔' : '→';
            console.log(`  ${icon} ${insight.title}`);
          });
        }
      }

      if (options.output === 'json') {
        console.log('\n' + JSON.stringify(result, null, 2));
      }
    } catch (error) {
      spinner.fail(chalk.red('Pattern extraction failed'));
      if (error instanceof Error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
      process.exit(1);
    }
  });

/**
 * Power command - Display power user analytics
 */
program
  .command('power')
  .description('Show power user analytics and efficiency metrics')
  .option('-d, --days <number>', 'Number of days to analyze', '30')
  .option('-o, --output <format>', 'Output format (text|json)', 'text')
  .option('--insights', 'Show actionable insights only')
  .action(async (options) => {
    const spinner = ora('Analyzing power user metrics...').start();

    try {
      const { analyzePowerUserMetrics, generateEfficiencyReport, getProductivityInsights } = await import('./analyzers/power-user');
      const data = await loadStoredData({ days: parseInt(options.days) });

      if (data.length === 0) {
        spinner.warn(chalk.yellow('No data found. Run `cit collect` first.'));
        return;
      }

      const metrics = analyzePowerUserMetrics(data);
      spinner.succeed(chalk.green('Analysis complete'));

      if (options.insights) {
        const insights = getProductivityInsights(metrics);
        console.log(chalk.bold('\n💡 Actionable Insights'));
        console.log(chalk.gray('━'.repeat(50)));

        const strengths = insights.filter(i => i.type === 'strength');
        const weaknesses = insights.filter(i => i.type === 'weakness');
        const opportunities = insights.filter(i => i.type === 'opportunity');

        if (strengths.length > 0) {
          console.log(chalk.green('\n  Strengths:'));
          strengths.forEach(i => {
            console.log(`    ✓ ${i.title}: ${i.description}`);
          });
        }

        if (weaknesses.length > 0) {
          console.log(chalk.red('\n  Areas for Improvement:'));
          weaknesses.forEach(i => {
            console.log(`    ⚠ ${i.title}: ${i.description}`);
            if (i.recommendation) {
              console.log(`      → ${i.recommendation}`);
            }
          });
        }

        if (opportunities.length > 0) {
          console.log(chalk.blue('\n  Opportunities:'));
          opportunities.forEach(i => {
            console.log(`    ◆ ${i.title}: ${i.description}`);
            if (i.recommendation) {
              console.log(`      → ${i.recommendation}`);
            }
          });
        }
      } else {
        console.log(generateEfficiencyReport(metrics));
      }

      if (options.output === 'json') {
        console.log('\n' + JSON.stringify(metrics, null, 2));
      }
    } catch (error) {
      spinner.fail(chalk.red('Power user analysis failed'));
      if (error instanceof Error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
      process.exit(1);
    }
  });

/**
 * Dashboard command - Launch the insights web dashboard
 */
program
  .command('dashboard')
  .description('Launch the insights web dashboard')
  .option('-p, --port <number>', 'Port number', '3456')
  .option('--no-open', 'Do not auto-open browser')
  .option('--dev', 'Run in dev mode (Vite)')
  .action(async (options) => {
    try {
      await startDashboard({
        port: parseInt(options.port),
        open: options.open,
        dev: options.dev || false,
      });
    } catch (error) {
      console.error(chalk.red('Failed to start dashboard'));
      if (error instanceof Error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
      process.exit(1);
    }
  });

// Parse CLI arguments
program.parse();
