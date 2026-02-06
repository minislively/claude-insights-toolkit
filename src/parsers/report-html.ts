/**
 * Report HTML Parser
 *
 * Parses Claude Code's report.html file and extracts all structured data
 * including stats, charts, narrative sections, recommendations, and more.
 */

import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface IReportStats {
  messages: number;
  sessions: number;
  linesAdded: number;
  linesRemoved: number;
  files: number;
  days: number;
  msgsPerDay: number;
}

export interface IChartData {
  title: string;
  items: Array<{ label: string; value: number }>;
}

export interface IProjectArea {
  name: string;
  sessionCount: string; // e.g. "~30 sessions"
  description: string;
}

export interface IBigWin {
  title: string;
  description: string;
}

export interface IFrictionCategory {
  title: string;
  description: string;
  examples: string[];
}

export interface IClaudeMdSuggestion {
  code: string;
  reason: string;
}

export interface IFeatureCard {
  title: string;
  oneliner: string;
  why: string;
  exampleCode?: string;
}

export interface IPatternCard {
  title: string;
  summary: string;
  detail: string;
  prompt?: string;
}

export interface IHorizonCard {
  title: string;
  description: string;
  tip: string;
  prompt?: string;
}

export interface IMultiClauding {
  overlapEvents: number;
  sessionsInvolved: number;
  ofMessages: string; // e.g. "77%"
}

export interface IResponseTimeStats {
  median: number;
  average: number;
}

export interface IReportData {
  // Metadata
  dateRange: { start: string; end: string };
  stats: IReportStats;

  // At a Glance
  glance: {
    whatsWorking: string;
    whatsHindering: string;
    quickWins: string;
    ambitiousWorkflows: string;
  };

  // Charts
  charts: IChartData[];

  // Multi-clauding
  multiClauding: IMultiClauding | null;

  // Response time
  responseTime: IResponseTimeStats | null;

  // Raw hour data
  hourlyActivity: Record<string, number>;

  // Sections
  projectAreas: IProjectArea[];
  narrative: {
    paragraphs: string[];
    keyInsight: string;
  };
  bigWins: IBigWin[];
  frictionCategories: IFrictionCategory[];
  claudeMdSuggestions: IClaudeMdSuggestion[];
  featureCards: IFeatureCard[];
  patternCards: IPatternCard[];
  horizonCards: IHorizonCard[];
  funEnding: { headline: string; detail: string } | null;
}

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/**
 * Parse a formatted number string by stripping commas.
 * Returns 0 if the string is not a valid number.
 */
function parseFormattedNumber(raw: string): number {
  const cleaned = raw.replace(/,/g, '').trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Trim and normalise whitespace in a text string.
 */
function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Section parsers
// ---------------------------------------------------------------------------

function parseDateRange($: cheerio.CheerioAPI): { start: string; end: string } {
  const subtitle = $('.subtitle').first().text();
  const match = subtitle.match(/(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return { start: match[1], end: match[2] };
  }
  return { start: '', end: '' };
}

function parseStats($: cheerio.CheerioAPI): IReportStats {
  const stats: IReportStats = {
    messages: 0,
    sessions: 0,
    linesAdded: 0,
    linesRemoved: 0,
    files: 0,
    days: 0,
    msgsPerDay: 0,
  };

  // Extract sessions from the subtitle text
  const subtitle = $('.subtitle').first().text();
  const sessionsMatch = subtitle.match(/([\d,]+)\s+messages\s+across\s+([\d,]+)\s+sessions/);
  if (sessionsMatch) {
    stats.sessions = parseFormattedNumber(sessionsMatch[2]);
  }

  // Extract stats from the stats-row
  $('.stats-row .stat').each(function (this: any) {
    const value = $(this).find('.stat-value').text().trim();
    const label = $(this).find('.stat-label').text().trim().toLowerCase();

    switch (label) {
      case 'messages':
        stats.messages = parseFormattedNumber(value);
        break;
      case 'lines': {
        // Format: "+66,520/-16,101"
        const parts = value.split('/');
        if (parts.length === 2) {
          stats.linesAdded = parseFormattedNumber(parts[0].replace('+', ''));
          stats.linesRemoved = parseFormattedNumber(parts[1].replace('-', ''));
        }
        break;
      }
      case 'files':
        stats.files = parseFormattedNumber(value);
        break;
      case 'days':
        stats.days = parseFormattedNumber(value);
        break;
      case 'msgs/day':
        stats.msgsPerDay = parseFormattedNumber(value);
        break;
    }
  });

  return stats;
}

function parseGlance($: cheerio.CheerioAPI): IReportData['glance'] {
  const glance = {
    whatsWorking: '',
    whatsHindering: '',
    quickWins: '',
    ambitiousWorkflows: '',
  };

  $('.glance-section').each(function (this: any) {
    const fullText = $(this).text();
    const strongText = $(this).find('strong').text().toLowerCase();

    // Strip the bold label prefix from the full text
    const content = cleanText(fullText.replace($(this).find('strong').text(), ''));

    if (strongText.includes('working')) {
      glance.whatsWorking = content;
    } else if (strongText.includes('hindering')) {
      glance.whatsHindering = content;
    } else if (strongText.includes('quick wins')) {
      glance.quickWins = content;
    } else if (strongText.includes('ambitious')) {
      glance.ambitiousWorkflows = content;
    }
  });

  return glance;
}

function parseCharts($: cheerio.CheerioAPI): IChartData[] {
  const charts: IChartData[] = [];

  $('.chart-card').each(function (this: any) {
    const title = cleanText($(this).find('.chart-title').first().text());

    // Skip the Multi-Clauding card; it is handled separately
    if (title.toLowerCase().includes('multi-clauding')) {
      return; // continue
    }

    const items: Array<{ label: string; value: number }> = [];

    $(this).find('.bar-row').each(function (this: any) {
      const label = cleanText($(this).find('.bar-label').text());
      const rawValue = $(this).find('.bar-value').text().trim();
      const value = parseFormattedNumber(rawValue.replace('%', ''));
      if (label) {
        items.push({ label, value });
      }
    });

    if (title && items.length > 0) {
      charts.push({ title, items });
    }
  });

  return charts;
}

function parseMultiClauding($: cheerio.CheerioAPI): IMultiClauding | null {
  let card: cheerio.Cheerio<any> | null = null;

  $('.chart-card').each(function (this: any): void | false {
    const title = $(this).find('.chart-title').first().text();
    if (title.toLowerCase().includes('multi-clauding')) {
      card = $(this);
      return false; // break
    }
  });

  if (!card) {
    return null;
  }

  // The multi-clauding card contains inline stat blocks with large styled numbers.
  const cardEl = card as cheerio.Cheerio<any>;
  const cardHtml = cardEl.html() || '';
  const cardText = cardEl.text();

  let overlapEvents = 0;
  let sessionsInvolved = 0;
  let ofMessages = '';

  // Parse from HTML: look for divs with large font-size (>=20px) styling
  const bigNumberDivs: string[] = [];
  const bigNumRegex = /font-size:\s*(2\d|[3-9]\d|\d{3,})px[^>]*>([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = bigNumRegex.exec(cardHtml)) !== null) {
    bigNumberDivs.push(m[2].trim());
  }

  if (bigNumberDivs.length >= 3) {
    overlapEvents = parseFormattedNumber(bigNumberDivs[0]);
    sessionsInvolved = parseFormattedNumber(bigNumberDivs[1]);
    ofMessages = bigNumberDivs[2];
  } else {
    // Fallback: look for styled stat-like divs with numbers/percentages
    const statDivRegex = /font-weight:\s*700[^>]*>([^<]+)/g;
    const statValues: string[] = [];
    while ((m = statDivRegex.exec(cardHtml)) !== null) {
      const val = m[1].trim();
      if (/^\d/.test(val)) {
        statValues.push(val);
      }
    }
    if (statValues.length >= 3) {
      overlapEvents = parseFormattedNumber(statValues[0]);
      sessionsInvolved = parseFormattedNumber(statValues[1]);
      ofMessages = statValues[2];
    }
  }

  // Verify we got at least some data
  if (overlapEvents === 0 && sessionsInvolved === 0 && !ofMessages) {
    return null;
  }

  return { overlapEvents, sessionsInvolved, ofMessages };
}

function parseResponseTime($: cheerio.CheerioAPI): IResponseTimeStats | null {
  const html = $.html();
  const match = html.match(/Median:\s*([\d.]+)s\s*(?:&bull;|[•·])\s*Average:\s*([\d.]+)s/);
  if (match) {
    return {
      median: parseFloat(match[1]),
      average: parseFloat(match[2]),
    };
  }
  return null;
}

function parseHourlyActivity($: cheerio.CheerioAPI): Record<string, number> {
  const html = $.html();
  const match = html.match(/rawHourCounts\s*=\s*(\{[^}]+\})/);
  if (match) {
    try {
      return JSON.parse(match[1]) as Record<string, number>;
    } catch {
      // malformed JSON -- return empty
    }
  }
  return {};
}

function parseProjectAreas($: cheerio.CheerioAPI): IProjectArea[] {
  const areas: IProjectArea[] = [];

  $('.project-area').each(function (this: any) {
    const name = cleanText($(this).find('.area-name').text());
    const sessionCount = cleanText($(this).find('.area-count').text());
    const description = cleanText($(this).find('.area-desc').text());
    if (name) {
      areas.push({ name, sessionCount, description });
    }
  });

  return areas;
}

function parseNarrative($: cheerio.CheerioAPI): IReportData['narrative'] {
  const paragraphs: string[] = [];
  let keyInsight = '';

  $('.narrative p').each(function (this: any) {
    const text = cleanText($(this).text());
    if (text) {
      paragraphs.push(text);
    }
  });

  const insightEl = $('.narrative .key-insight');
  if (insightEl.length) {
    const fullText = insightEl.text();
    const strongText = insightEl.find('strong').text();
    keyInsight = cleanText(fullText.replace(strongText, ''));
  }

  return { paragraphs, keyInsight };
}

function parseBigWins($: cheerio.CheerioAPI): IBigWin[] {
  const wins: IBigWin[] = [];

  $('.big-win').each(function (this: any) {
    const title = cleanText($(this).find('.big-win-title').text());
    const description = cleanText($(this).find('.big-win-desc').text());
    if (title) {
      wins.push({ title, description });
    }
  });

  return wins;
}

function parseFrictionCategories($: cheerio.CheerioAPI): IFrictionCategory[] {
  const categories: IFrictionCategory[] = [];

  $('.friction-category').each(function (this: any) {
    const title = cleanText($(this).find('.friction-title').text());
    const description = cleanText($(this).find('.friction-desc').text());
    const examples: string[] = [];

    $(this).find('.friction-examples li').each(function (this: any) {
      const text = cleanText($(this).text());
      if (text) {
        examples.push(text);
      }
    });

    if (title) {
      categories.push({ title, description, examples });
    }
  });

  return categories;
}

function parseClaudeMdSuggestions($: cheerio.CheerioAPI): IClaudeMdSuggestion[] {
  const suggestions: IClaudeMdSuggestion[] = [];

  $('.claude-md-item').each(function (this: any) {
    const code = $(this).find('.cmd-code').text().trim();
    const reason = cleanText($(this).find('.cmd-why').text());
    if (code) {
      suggestions.push({ code, reason });
    }
  });

  return suggestions;
}

function parseFeatureCards($: cheerio.CheerioAPI): IFeatureCard[] {
  const cards: IFeatureCard[] = [];

  $('.feature-card').each(function (this: any) {
    const title = cleanText($(this).find('.feature-title').text());
    const oneliner = cleanText($(this).find('.feature-oneliner').text());
    const why = cleanText($(this).find('.feature-why').text());
    const exampleCodeEl = $(this).find('.example-code');
    const exampleCode = exampleCodeEl.length ? exampleCodeEl.text().trim() : undefined;

    if (title) {
      cards.push({ title, oneliner, why, exampleCode });
    }
  });

  return cards;
}

function parsePatternCards($: cheerio.CheerioAPI): IPatternCard[] {
  const cards: IPatternCard[] = [];

  $('.pattern-card').each(function (this: any) {
    const title = cleanText($(this).find('.pattern-title').text());
    const summary = cleanText($(this).find('.pattern-summary').text());
    const detail = cleanText($(this).find('.pattern-detail').text());
    const promptEl = $(this).find('.copyable-prompt');
    const prompt = promptEl.length ? promptEl.text().trim() : undefined;

    if (title) {
      cards.push({ title, summary, detail, prompt });
    }
  });

  return cards;
}

function parseHorizonCards($: cheerio.CheerioAPI): IHorizonCard[] {
  const cards: IHorizonCard[] = [];

  $('.horizon-card').each(function (this: any) {
    const title = cleanText($(this).find('.horizon-title').text());
    const description = cleanText($(this).find('.horizon-possible').text());
    const tip = cleanText($(this).find('.horizon-tip').text());
    const promptEl = $(this).find('.pattern-prompt code, code');
    const prompt = promptEl.length ? promptEl.text().trim() : undefined;

    if (title) {
      cards.push({ title, description, tip, prompt });
    }
  });

  return cards;
}

function parseFunEnding($: cheerio.CheerioAPI): IReportData['funEnding'] {
  const el = $('.fun-ending');
  if (!el.length) {
    return null;
  }

  const headline = cleanText(el.find('.fun-headline').text());
  const detail = cleanText(el.find('.fun-detail').text());

  if (!headline && !detail) {
    return null;
  }

  return { headline, detail };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a report.html string and extract all structured data.
 */
export function parseReportHtml(html: string): IReportData {
  const $ = cheerio.load(html);

  return {
    dateRange: parseDateRange($),
    stats: parseStats($),
    glance: parseGlance($),
    charts: parseCharts($),
    multiClauding: parseMultiClauding($),
    responseTime: parseResponseTime($),
    hourlyActivity: parseHourlyActivity($),
    projectAreas: parseProjectAreas($),
    narrative: parseNarrative($),
    bigWins: parseBigWins($),
    frictionCategories: parseFrictionCategories($),
    claudeMdSuggestions: parseClaudeMdSuggestions($),
    featureCards: parseFeatureCards($),
    patternCards: parsePatternCards($),
    horizonCards: parseHorizonCards($),
    funEnding: parseFunEnding($),
  };
}

/**
 * Locate and load the most recent report.html file.
 *
 * Search order:
 *   1. ~/claude-insights/reports/  (most recent report-*.html by name)
 *   2. ~/.claude/usage-data/report.html
 *
 * Returns null if no report file is found.
 */
export async function loadLatestReport(): Promise<IReportData | null> {
  // 1. Check ~/claude-insights/reports/ for the most recent file
  const reportsDir = path.join(homedir(), 'claude-insights', 'reports');
  try {
    const files = await fs.readdir(reportsDir);
    const reportFiles = files
      .filter(f => f.endsWith('.html'))
      .sort()
      .reverse();

    if (reportFiles.length > 0) {
      const filePath = path.join(reportsDir, reportFiles[0]);
      const html = await fs.readFile(filePath, 'utf-8');
      return parseReportHtml(html);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
    // Directory doesn't exist -- fall through to next source
  }

  // 2. Fallback to ~/.claude/usage-data/report.html
  const fallbackPath = path.join(homedir(), '.claude', 'usage-data', 'report.html');
  try {
    const html = await fs.readFile(fallbackPath, 'utf-8');
    return parseReportHtml(html);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  return null;
}
