/**
 * Tests for report HTML parser
 */

import { parseReportHtml, IReportData } from '../report-html';

describe('parseReportHtml', () => {
  describe('parseDateRange', () => {
    it('extracts date range from subtitle', () => {
      const html = `
        <div class="subtitle">6,420 messages across 333 sessions | 2024-11-17 to 2025-02-05</div>
      `;
      const result = parseReportHtml(html);
      expect(result.dateRange).toEqual({
        start: '2024-11-17',
        end: '2025-02-05',
      });
    });

    it('returns empty strings when no date range found', () => {
      const html = '<div class="subtitle">No dates here</div>';
      const result = parseReportHtml(html);
      expect(result.dateRange).toEqual({ start: '', end: '' });
    });
  });

  describe('parseStats', () => {
    it('extracts all stats from subtitle and stats-row', () => {
      const html = `
        <div class="subtitle">6,420 messages across 333 sessions</div>
        <div class="stats-row">
          <div class="stat"><div class="stat-value">6,420</div><div class="stat-label">Messages</div></div>
          <div class="stat"><div class="stat-value">+66,520/-16,101</div><div class="stat-label">Lines</div></div>
          <div class="stat"><div class="stat-value">1,234</div><div class="stat-label">Files</div></div>
          <div class="stat"><div class="stat-value">81</div><div class="stat-label">Days</div></div>
          <div class="stat"><div class="stat-value">79.3</div><div class="stat-label">Msgs/day</div></div>
        </div>
      `;
      const result = parseReportHtml(html);
      expect(result.stats).toEqual({
        messages: 6420,
        sessions: 333,
        linesAdded: 66520,
        linesRemoved: 16101,
        files: 1234,
        days: 81,
        msgsPerDay: 79.3,
      });
    });

    it('handles commas in numbers', () => {
      const html = `
        <div class="subtitle">10,000 messages across 100 sessions</div>
        <div class="stats-row">
          <div class="stat"><div class="stat-value">10,000</div><div class="stat-label">Messages</div></div>
          <div class="stat"><div class="stat-value">+1,000/-500</div><div class="stat-label">Lines</div></div>
        </div>
      `;
      const result = parseReportHtml(html);
      expect(result.stats.messages).toBe(10000);
      expect(result.stats.sessions).toBe(100);
      expect(result.stats.linesAdded).toBe(1000);
      expect(result.stats.linesRemoved).toBe(500);
    });

    it('returns zero for missing stats', () => {
      const html = '<div></div>';
      const result = parseReportHtml(html);
      expect(result.stats).toEqual({
        messages: 0,
        sessions: 0,
        linesAdded: 0,
        linesRemoved: 0,
        files: 0,
        days: 0,
        msgsPerDay: 0,
      });
    });
  });

  describe('parseGlance', () => {
    it('extracts at-a-glance sections', () => {
      const html = `
        <div class="glance-section"><strong>What's working:</strong> Great code generation</div>
        <div class="glance-section"><strong>What's hindering:</strong> Context limits</div>
        <div class="glance-section"><strong>Quick wins:</strong> Better prompts</div>
        <div class="glance-section"><strong>Ambitious workflows:</strong> Multi-agent systems</div>
      `;
      const result = parseReportHtml(html);
      expect(result.glance).toEqual({
        whatsWorking: 'Great code generation',
        whatsHindering: 'Context limits',
        quickWins: 'Better prompts',
        ambitiousWorkflows: 'Multi-agent systems',
      });
    });

    it('normalizes whitespace in glance text', () => {
      const html = `
        <div class="glance-section"><strong>What's working:</strong>   Multiple   spaces   here  </div>
      `;
      const result = parseReportHtml(html);
      expect(result.glance.whatsWorking).toBe('Multiple spaces here');
    });

    it('returns empty strings for missing glance sections', () => {
      const html = '<div></div>';
      const result = parseReportHtml(html);
      expect(result.glance).toEqual({
        whatsWorking: '',
        whatsHindering: '',
        quickWins: '',
        ambitiousWorkflows: '',
      });
    });
  });

  describe('parseCharts', () => {
    it('extracts chart data from chart-card elements', () => {
      const html = `
        <div class="chart-card">
          <div class="chart-title">Top Languages</div>
          <div class="bar-row"><div class="bar-label">TypeScript</div><div class="bar-value">45%</div></div>
          <div class="bar-row"><div class="bar-label">Python</div><div class="bar-value">30%</div></div>
        </div>
        <div class="chart-card">
          <div class="chart-title">Top Tools</div>
          <div class="bar-row"><div class="bar-label">Bash</div><div class="bar-value">60</div></div>
        </div>
      `;
      const result = parseReportHtml(html);
      expect(result.charts).toEqual([
        {
          title: 'Top Languages',
          items: [
            { label: 'TypeScript', value: 45 },
            { label: 'Python', value: 30 },
          ],
        },
        {
          title: 'Top Tools',
          items: [{ label: 'Bash', value: 60 }],
        },
      ]);
    });

    it('skips multi-clauding chart', () => {
      const html = `
        <div class="chart-card">
          <div class="chart-title">Multi-Clauding Activity</div>
          <div class="bar-row"><div class="bar-label">Something</div><div class="bar-value">10</div></div>
        </div>
        <div class="chart-card">
          <div class="chart-title">Languages</div>
          <div class="bar-row"><div class="bar-label">TypeScript</div><div class="bar-value">50</div></div>
        </div>
      `;
      const result = parseReportHtml(html);
      expect(result.charts).toHaveLength(1);
      expect(result.charts[0].title).toBe('Languages');
    });

    it('returns empty array when no charts found', () => {
      const html = '<div></div>';
      const result = parseReportHtml(html);
      expect(result.charts).toEqual([]);
    });
  });

  describe('parseProjectAreas', () => {
    it('extracts project area information', () => {
      const html = `
        <div class="project-area">
          <div class="area-name">Backend API</div>
          <div class="area-count">~30 sessions</div>
          <div class="area-desc">REST API development</div>
        </div>
        <div class="project-area">
          <div class="area-name">Frontend</div>
          <div class="area-count">~20 sessions</div>
          <div class="area-desc">UI components</div>
        </div>
      `;
      const result = parseReportHtml(html);
      expect(result.projectAreas).toEqual([
        {
          name: 'Backend API',
          sessionCount: '~30 sessions',
          description: 'REST API development',
        },
        {
          name: 'Frontend',
          sessionCount: '~20 sessions',
          description: 'UI components',
        },
      ]);
    });

    it('returns empty array when no project areas found', () => {
      const html = '<div></div>';
      const result = parseReportHtml(html);
      expect(result.projectAreas).toEqual([]);
    });
  });

  describe('parseBigWins', () => {
    it('extracts big win items', () => {
      const html = `
        <div class="big-win">
          <div class="big-win-title">Auth System</div>
          <div class="big-win-desc">Implemented OAuth2 flow</div>
        </div>
        <div class="big-win">
          <div class="big-win-title">Performance</div>
          <div class="big-win-desc">Reduced load time by 50%</div>
        </div>
      `;
      const result = parseReportHtml(html);
      expect(result.bigWins).toEqual([
        {
          title: 'Auth System',
          description: 'Implemented OAuth2 flow',
        },
        {
          title: 'Performance',
          description: 'Reduced load time by 50%',
        },
      ]);
    });

    it('returns empty array when no big wins found', () => {
      const html = '<div></div>';
      const result = parseReportHtml(html);
      expect(result.bigWins).toEqual([]);
    });
  });

  describe('parseFrictionCategories', () => {
    it('extracts friction categories with examples', () => {
      const html = `
        <div class="friction-category">
          <div class="friction-title">Context Loss</div>
          <div class="friction-desc">Sessions hitting context limits</div>
          <div class="friction-examples">
            <ul>
              <li>Long refactoring sessions</li>
              <li>Multi-file changes</li>
            </ul>
          </div>
        </div>
        <div class="friction-category">
          <div class="friction-title">Tool Errors</div>
          <div class="friction-desc">Failed API calls</div>
          <div class="friction-examples">
            <ul>
              <li>Network timeouts</li>
            </ul>
          </div>
        </div>
      `;
      const result = parseReportHtml(html);
      expect(result.frictionCategories).toEqual([
        {
          title: 'Context Loss',
          description: 'Sessions hitting context limits',
          examples: ['Long refactoring sessions', 'Multi-file changes'],
        },
        {
          title: 'Tool Errors',
          description: 'Failed API calls',
          examples: ['Network timeouts'],
        },
      ]);
    });

    it('handles categories without examples', () => {
      const html = `
        <div class="friction-category">
          <div class="friction-title">General Issues</div>
          <div class="friction-desc">Various problems</div>
        </div>
      `;
      const result = parseReportHtml(html);
      expect(result.frictionCategories).toEqual([
        {
          title: 'General Issues',
          description: 'Various problems',
          examples: [],
        },
      ]);
    });

    it('returns empty array when no friction categories found', () => {
      const html = '<div></div>';
      const result = parseReportHtml(html);
      expect(result.frictionCategories).toEqual([]);
    });
  });

  describe('parseClaudeMdSuggestions', () => {
    it('extracts CLAUDE.md suggestions', () => {
      const html = `
        <div class="claude-md-item">
          <div class="cmd-code">Add architecture docs</div>
          <div class="cmd-why">Reduces context confusion</div>
        </div>
        <div class="claude-md-item">
          <div class="cmd-code">Use TypeScript strict mode</div>
          <div class="cmd-why">Catches type errors early</div>
        </div>
      `;
      const result = parseReportHtml(html);
      expect(result.claudeMdSuggestions).toEqual([
        {
          code: 'Add architecture docs',
          reason: 'Reduces context confusion',
        },
        {
          code: 'Use TypeScript strict mode',
          reason: 'Catches type errors early',
        },
      ]);
    });

    it('returns empty array when no suggestions found', () => {
      const html = '<div></div>';
      const result = parseReportHtml(html);
      expect(result.claudeMdSuggestions).toEqual([]);
    });
  });

  describe('parseResponseTime', () => {
    it('extracts median and average response times with bullet separator', () => {
      const html = '<div>Median: 2.5s &bull; Average: 3.2s</div>';
      const result = parseReportHtml(html);
      expect(result.responseTime).toEqual({
        median: 2.5,
        average: 3.2,
      });
    });

    it('handles different bullet characters', () => {
      const html = '<div>Median: 1.8s • Average: 2.1s</div>';
      const result = parseReportHtml(html);
      expect(result.responseTime).toEqual({
        median: 1.8,
        average: 2.1,
      });
    });

    it('returns null when no response time data found', () => {
      const html = '<div>No response time data</div>';
      const result = parseReportHtml(html);
      expect(result.responseTime).toBeNull();
    });
  });

  describe('parseHourlyActivity', () => {
    it('extracts hourly activity data from rawHourCounts', () => {
      const html = `
        <script>
          const rawHourCounts = {"0":5,"1":3,"12":50,"23":10};
        </script>
      `;
      const result = parseReportHtml(html);
      expect(result.hourlyActivity).toEqual({
        '0': 5,
        '1': 3,
        '12': 50,
        '23': 10,
      });
    });

    it('returns empty object when rawHourCounts not found', () => {
      const html = '<div>No hour counts</div>';
      const result = parseReportHtml(html);
      expect(result.hourlyActivity).toEqual({});
    });

    it('returns empty object for malformed JSON', () => {
      const html = '<script>const rawHourCounts = {invalid json};</script>';
      const result = parseReportHtml(html);
      expect(result.hourlyActivity).toEqual({});
    });
  });

  describe('parseNarrative', () => {
    it('extracts narrative paragraphs and key insight', () => {
      const html = `
        <div class="narrative">
          <p>You had a great week.</p>
          <p>Your productivity improved significantly.</p>
          <div class="key-insight"><strong>Key Insight:</strong> Focus on architecture first</div>
        </div>
      `;
      const result = parseReportHtml(html);
      expect(result.narrative).toEqual({
        paragraphs: ['You had a great week.', 'Your productivity improved significantly.'],
        keyInsight: 'Focus on architecture first',
      });
    });

    it('handles narrative without key insight', () => {
      const html = `
        <div class="narrative">
          <p>Some narrative text.</p>
        </div>
      `;
      const result = parseReportHtml(html);
      expect(result.narrative).toEqual({
        paragraphs: ['Some narrative text.'],
        keyInsight: '',
      });
    });

    it('returns empty arrays when no narrative found', () => {
      const html = '<div></div>';
      const result = parseReportHtml(html);
      expect(result.narrative).toEqual({
        paragraphs: [],
        keyInsight: '',
      });
    });
  });

  describe('parseFeatureCards', () => {
    it('extracts feature cards with all fields', () => {
      const html = `
        <div class="feature-card">
          <div class="feature-title">Auto Completion</div>
          <div class="feature-oneliner">Fast code completions</div>
          <div class="feature-why">Speeds up development</div>
          <div class="example-code">const x = 1;</div>
        </div>
      `;
      const result = parseReportHtml(html);
      expect(result.featureCards).toEqual([
        {
          title: 'Auto Completion',
          oneliner: 'Fast code completions',
          why: 'Speeds up development',
          exampleCode: 'const x = 1;',
        },
      ]);
    });

    it('handles feature cards without example code', () => {
      const html = `
        <div class="feature-card">
          <div class="feature-title">Quick Fix</div>
          <div class="feature-oneliner">Fix errors quickly</div>
          <div class="feature-why">Saves time</div>
        </div>
      `;
      const result = parseReportHtml(html);
      expect(result.featureCards[0].exampleCode).toBeUndefined();
    });

    it('returns empty array when no feature cards found', () => {
      const html = '<div></div>';
      const result = parseReportHtml(html);
      expect(result.featureCards).toEqual([]);
    });
  });

  describe('parsePatternCards', () => {
    it('extracts pattern cards with all fields', () => {
      const html = `
        <div class="pattern-card">
          <div class="pattern-title">Test-Driven Development</div>
          <div class="pattern-summary">Write tests first</div>
          <div class="pattern-detail">Ensures code quality from the start</div>
          <div class="copyable-prompt">Implement TDD for new features</div>
        </div>
      `;
      const result = parseReportHtml(html);
      expect(result.patternCards).toEqual([
        {
          title: 'Test-Driven Development',
          summary: 'Write tests first',
          detail: 'Ensures code quality from the start',
          prompt: 'Implement TDD for new features',
        },
      ]);
    });

    it('handles pattern cards without prompt', () => {
      const html = `
        <div class="pattern-card">
          <div class="pattern-title">Code Review</div>
          <div class="pattern-summary">Review before merge</div>
          <div class="pattern-detail">Catches bugs early</div>
        </div>
      `;
      const result = parseReportHtml(html);
      expect(result.patternCards[0].prompt).toBeUndefined();
    });

    it('returns empty array when no pattern cards found', () => {
      const html = '<div></div>';
      const result = parseReportHtml(html);
      expect(result.patternCards).toEqual([]);
    });
  });

  describe('parseHorizonCards', () => {
    it('extracts horizon cards with all fields', () => {
      const html = `
        <div class="horizon-card">
          <div class="horizon-title">AI Pair Programming</div>
          <div class="horizon-possible">Real-time AI assistance</div>
          <div class="horizon-tip">Start with simple tasks</div>
          <code>Try AI-assisted refactoring</code>
        </div>
      `;
      const result = parseReportHtml(html);
      expect(result.horizonCards).toEqual([
        {
          title: 'AI Pair Programming',
          description: 'Real-time AI assistance',
          tip: 'Start with simple tasks',
          prompt: 'Try AI-assisted refactoring',
        },
      ]);
    });

    it('handles horizon cards without prompt', () => {
      const html = `
        <div class="horizon-card">
          <div class="horizon-title">Advanced Workflows</div>
          <div class="horizon-possible">Automate everything</div>
          <div class="horizon-tip">Start small</div>
        </div>
      `;
      const result = parseReportHtml(html);
      expect(result.horizonCards[0].prompt).toBeUndefined();
    });

    it('returns empty array when no horizon cards found', () => {
      const html = '<div></div>';
      const result = parseReportHtml(html);
      expect(result.horizonCards).toEqual([]);
    });
  });

  describe('parseFunEnding', () => {
    it('extracts fun ending section', () => {
      const html = `
        <div class="fun-ending">
          <div class="fun-headline">Amazing progress!</div>
          <div class="fun-detail">You shipped 10 features this week</div>
        </div>
      `;
      const result = parseReportHtml(html);
      expect(result.funEnding).toEqual({
        headline: 'Amazing progress!',
        detail: 'You shipped 10 features this week',
      });
    });

    it('returns null when no fun ending found', () => {
      const html = '<div></div>';
      const result = parseReportHtml(html);
      expect(result.funEnding).toBeNull();
    });

    it('returns null when fun ending is empty', () => {
      const html = `
        <div class="fun-ending">
          <div class="fun-headline"></div>
          <div class="fun-detail"></div>
        </div>
      `;
      const result = parseReportHtml(html);
      expect(result.funEnding).toBeNull();
    });
  });

  describe('parseMultiClauding', () => {
    it('extracts multi-clauding data from styled divs', () => {
      const html = `
        <div class="chart-card">
          <div class="chart-title">Multi-Clauding Activity</div>
          <div style="font-size: 24px; font-weight: 700;">42</div>
          <div>overlap events</div>
          <div style="font-size: 24px; font-weight: 700;">15</div>
          <div>sessions involved</div>
          <div style="font-size: 24px; font-weight: 700;">77%</div>
          <div>of messages</div>
        </div>
      `;
      const result = parseReportHtml(html);
      expect(result.multiClauding).toEqual({
        overlapEvents: 42,
        sessionsInvolved: 15,
        ofMessages: '77%',
      });
    });

    it('returns null when no multi-clauding card found', () => {
      const html = '<div></div>';
      const result = parseReportHtml(html);
      expect(result.multiClauding).toBeNull();
    });

    it('returns null when multi-clauding data is incomplete', () => {
      const html = `
        <div class="chart-card">
          <div class="chart-title">Multi-Clauding Activity</div>
          <div>No styled numbers here</div>
        </div>
      `;
      const result = parseReportHtml(html);
      expect(result.multiClauding).toBeNull();
    });
  });

  describe('empty HTML', () => {
    it('returns all default values for empty HTML', () => {
      const html = '<div></div>';
      const result = parseReportHtml(html);

      expect(result.dateRange).toEqual({ start: '', end: '' });
      expect(result.stats).toEqual({
        messages: 0,
        sessions: 0,
        linesAdded: 0,
        linesRemoved: 0,
        files: 0,
        days: 0,
        msgsPerDay: 0,
      });
      expect(result.glance).toEqual({
        whatsWorking: '',
        whatsHindering: '',
        quickWins: '',
        ambitiousWorkflows: '',
      });
      expect(result.charts).toEqual([]);
      expect(result.multiClauding).toBeNull();
      expect(result.responseTime).toBeNull();
      expect(result.hourlyActivity).toEqual({});
      expect(result.projectAreas).toEqual([]);
      expect(result.narrative).toEqual({ paragraphs: [], keyInsight: '' });
      expect(result.bigWins).toEqual([]);
      expect(result.frictionCategories).toEqual([]);
      expect(result.claudeMdSuggestions).toEqual([]);
      expect(result.featureCards).toEqual([]);
      expect(result.patternCards).toEqual([]);
      expect(result.horizonCards).toEqual([]);
      expect(result.funEnding).toBeNull();
    });
  });
});
