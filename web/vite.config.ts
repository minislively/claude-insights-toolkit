import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'
import { homedir } from 'os'

const DATA_DIR = path.join(homedir(), 'claude-insights', 'data')

function insightsApiPlugin() {
  return {
    name: 'insights-api',
    configureServer(server: any) {
      server.middlewares.use('/api/data', async (req: any, res: any) => {
        try {
          const url = new URL(req.url!, `http://${req.headers.host}`)
          const days = parseInt(url.searchParams.get('days') || '30', 10)

          let files: string[] = []
          try {
            const allFiles = fs.readdirSync(DATA_DIR)
              .filter((f: string) => f.endsWith('.json'))
              .sort()
              .reverse()
            files = days === 0 ? allFiles : allFiles.slice(0, days)
          } catch {
            files = []
          }

          const data = files.map((f: string) => {
            const content = fs.readFileSync(path.join(DATA_DIR, f), 'utf-8')
            return JSON.parse(content)
          })

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(data))
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'Failed to load data' }))
        }
      })

      server.middlewares.use('/api/dates', async (_req: any, res: any) => {
        try {
          let files: string[] = []
          try {
            files = fs.readdirSync(DATA_DIR)
              .filter((f: string) => f.endsWith('.json'))
              .map((f: string) => f.replace('.json', ''))
              .sort()
              .reverse()
          } catch {
            files = []
          }
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(files))
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'Failed to list dates' }))
        }
      })

      server.middlewares.use('/api/reports', async (_req: any, res: any) => {
        const REPORTS_DIR = path.join(homedir(), 'claude-insights', 'reports')
        try {
          let files: string[] = []
          try {
            files = fs.readdirSync(REPORTS_DIR)
              .filter((f: string) => f.endsWith('.html'))
              .sort()
              .reverse()
          } catch {
            files = []
          }
          const reports = files.map((f: string) => ({
            filename: f,
            date: f.replace('report-', '').replace('.html', ''),
          }))
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(reports))
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'Failed to list reports' }))
        }
      })

      server.middlewares.use('/api/report/', async (req: any, res: any) => {
        const REPORTS_DIR = path.join(homedir(), 'claude-insights', 'reports')
        try {
          const url = new URL(req.url!, `http://${req.headers.host}`)
          const filename = url.pathname.replace('/api/report/', '')

          if (!filename || !filename.endsWith('.html')) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Invalid filename' }))
            return
          }

          const filePath = path.join(REPORTS_DIR, filename)

          // Security: ensure file is within REPORTS_DIR
          if (!filePath.startsWith(REPORTS_DIR)) {
            res.statusCode = 403
            res.end(JSON.stringify({ error: 'Access denied' }))
            return
          }

          const content = fs.readFileSync(filePath, 'utf-8')
          res.setHeader('Content-Type', 'text/html')
          res.end(content)
        } catch (err) {
          res.statusCode = 404
          res.end(JSON.stringify({ error: 'Report not found' }))
        }
      })

      server.middlewares.use('/api/snapshots', async (_req: any, res: any) => {
        const SNAPSHOTS_DIR = path.join(homedir(), 'claude-insights', 'snapshots')
        try {
          let files: string[] = []
          try {
            files = fs.readdirSync(SNAPSHOTS_DIR)
              .filter((f: string) => f.endsWith('.json'))
              .sort()
              .reverse()
          } catch {
            files = []
          }
          const snapshots = files.map((f: string) => {
            const content = fs.readFileSync(path.join(SNAPSHOTS_DIR, f), 'utf-8')
            return JSON.parse(content)
          })
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(snapshots))
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'Failed to load snapshots' }))
        }
      })

      server.middlewares.use('/api/profile', async (_req: any, res: any) => {
        try {
          // Find the latest report
          const REPORTS_DIR = path.join(homedir(), 'claude-insights', 'reports')
          let reportHtml = ''

          try {
            const files = fs.readdirSync(REPORTS_DIR)
              .filter((f: string) => f.endsWith('.html'))
              .sort()
              .reverse()
            if (files.length > 0) {
              reportHtml = fs.readFileSync(path.join(REPORTS_DIR, files[0]), 'utf-8')
            }
          } catch { /* no reports dir */ }

          if (!reportHtml) {
            const fallback = path.join(homedir(), '.claude', 'usage-data', 'report.html')
            try {
              reportHtml = fs.readFileSync(fallback, 'utf-8')
            } catch { /* no fallback */ }
          }

          if (!reportHtml) {
            res.setHeader('Content-Type', 'application/json')
            res.end('null')
            return
          }

          // Dynamic import of cheerio and parse
          const cheerio = await import('cheerio')
          const $ = cheerio.load(reportHtml)

          // Inline minimal parsing (we can't easily import the TypeScript source at dev time)
          // This duplicates the parser logic minimally for the dev server
          function cleanText(text: string): string {
            return text.replace(/\s+/g, ' ').trim()
          }
          function parseNum(raw: string): number {
            const num = Number(raw.replace(/,/g, '').trim())
            return Number.isFinite(num) ? num : 0
          }

          // Date range
          const subtitle = $('.subtitle').first().text()
          const dateMatch = subtitle.match(/(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/)
          const dateRange = dateMatch ? { start: dateMatch[1], end: dateMatch[2] } : { start: '', end: '' }

          // Stats
          const sessionsMatch = subtitle.match(/([\d,]+)\s+messages\s+across\s+([\d,]+)\s+sessions/)
          const stats: any = { messages: 0, sessions: 0, linesAdded: 0, linesRemoved: 0, files: 0, days: 0, msgsPerDay: 0 }
          if (sessionsMatch) { stats.sessions = parseNum(sessionsMatch[2]) }

          $('.stats-row .stat').each(function() {
            const value = $(this).find('.stat-value').text().trim()
            const label = $(this).find('.stat-label').text().trim().toLowerCase()
            if (label === 'messages') stats.messages = parseNum(value)
            else if (label === 'lines') { const parts = value.split('/'); if (parts.length === 2) { stats.linesAdded = parseNum(parts[0].replace('+', '')); stats.linesRemoved = parseNum(parts[1].replace('-', '')) } }
            else if (label === 'files') stats.files = parseNum(value)
            else if (label === 'days') stats.days = parseNum(value)
            else if (label === 'msgs/day') stats.msgsPerDay = parseNum(value)
          })

          // Charts
          const charts: any[] = []
          $('.chart-card').each(function() {
            const title = cleanText($(this).find('.chart-title').first().text())
            if (title.toLowerCase().includes('multi-clauding')) return
            const items: any[] = []
            $(this).find('.bar-row').each(function() {
              const label = cleanText($(this).find('.bar-label').text())
              const rawVal = $(this).find('.bar-value').text().trim()
              const value = parseNum(rawVal.replace('%', ''))
              if (label) items.push({ label, value })
            })
            if (title && items.length > 0) charts.push({ title, items })
          })

          // Multi-clauding
          let multiClauding = null
          $('.chart-card').each(function() {
            const title = $(this).find('.chart-title').first().text()
            if (title.toLowerCase().includes('multi-clauding')) {
              const text = $(this).text()
              const nums = text.match(/(\d[\d,.]*%?)/g)
              if (nums && nums.length >= 3) {
                multiClauding = { overlapEvents: parseNum(nums[0]), sessionsInvolved: parseNum(nums[1]), ofMessages: nums[2].includes('%') ? nums[2] : nums[2] + '%' }
              }
              return false
            }
          })

          // Response time
          const html = $.html()
          const rtMatch = html.match(/Median:\s*([\d.]+)s\s*(?:&bull;|[•·])\s*Average:\s*([\d.]+)s/)
          const responseTime = rtMatch ? { median: parseFloat(rtMatch[1]), average: parseFloat(rtMatch[2]) } : null

          // Hourly activity
          const hourMatch = html.match(/rawHourCounts\s*=\s*(\{[^}]+\})/)
          const hourlyActivity = hourMatch ? JSON.parse(hourMatch[1]) : {}

          // Project areas
          const projectAreas: any[] = []
          $('.project-area').each(function() {
            projectAreas.push({ name: cleanText($(this).find('.area-name').text()), sessionCount: cleanText($(this).find('.area-count').text()), description: cleanText($(this).find('.area-desc').text()) })
          })

          // Narrative
          const paragraphs: string[] = []
          $('.narrative p').each(function() { const t = cleanText($(this).text()); if (t) paragraphs.push(t) })
          const insightEl = $('.narrative .key-insight')
          const keyInsight = insightEl.length ? cleanText(insightEl.text().replace(insightEl.find('strong').text(), '')) : ''

          // Big wins
          const bigWins: any[] = []
          $('.big-win').each(function() { bigWins.push({ title: cleanText($(this).find('.big-win-title').text()), description: cleanText($(this).find('.big-win-desc').text()) }) })

          // Friction
          const frictionCategories: any[] = []
          $('.friction-category').each(function() {
            const examples: string[] = []
            $(this).find('.friction-examples li').each(function() { const t = cleanText($(this).text()); if (t) examples.push(t) })
            frictionCategories.push({ title: cleanText($(this).find('.friction-title').text()), description: cleanText($(this).find('.friction-desc').text()), examples })
          })

          // CLAUDE.md suggestions
          const claudeMdSuggestions: any[] = []
          $('.claude-md-item').each(function() { claudeMdSuggestions.push({ code: $(this).find('.cmd-code').text().trim(), reason: cleanText($(this).find('.cmd-why').text()) }) })

          // Feature cards
          const featureCards: any[] = []
          $('.feature-card').each(function() { featureCards.push({ title: cleanText($(this).find('.feature-title').text()), oneliner: cleanText($(this).find('.feature-oneliner').text()), why: cleanText($(this).find('.feature-why').text()) }) })

          // Build profile
          function findChart(title: string) { return charts.find((c: any) => c.title.toLowerCase().includes(title.toLowerCase())) }
          function withPct(items: any[]) { const total = items.reduce((s: number, i: any) => s + i.value, 0); return items.map((i: any) => ({ name: i.label, value: i.value, percentage: total > 0 ? Math.round((i.value / total) * 100) : 0 })) }

          const langChart = findChart('language')
          const languages = langChart ? withPct(langChart.items) : []
          const toolChart = findChart('tool')
          const tools = toolChart ? withPct(toolChart.items) : []
          const stChart = findChart('session type')
          const stItems = stChart ? withPct(stChart.items) : []
          const sessionTypeBreakdown = stItems.map((i: any) => ({ type: i.name, count: i.value, percentage: i.percentage }))
          const gcChart = findChart('what you wanted')
          const gcItems = gcChart ? withPct(gcChart.items) : []
          const goalCategories = gcItems.map((i: any) => ({ name: i.name, count: i.value, percentage: i.percentage }))
          const outChart = findChart('outcome')
          const outcomes = outChart ? outChart.items.map((i: any) => ({ name: i.label, count: i.value })) : []
          const oTotal = outcomes.reduce((s: number, o: any) => s + o.count, 0)
          const oSuccess = outcomes.filter((o: any) => o.name.toLowerCase().includes('full') || o.name.toLowerCase().includes('most')).reduce((s: number, o: any) => s + o.count, 0)
          const successRate = oTotal > 0 ? Math.round((oSuccess / oTotal) * 100) : 0
          const helpChart = findChart('what helped')
          const whatHelpsMost = helpChart ? helpChart.items.map((i: any) => ({ name: i.label, count: i.value })) : []
          const frChart = findChart('friction')
          const topFrictionTypes = frChart ? frChart.items.map((i: any) => ({ name: i.label, count: i.value })) : []
          const satChart = findChart('satisfaction')
          const satDist = satChart ? satChart.items.map((i: any) => ({ name: i.label, count: i.value })) : []
          const posTerms = ['satisfied', 'likely_satisfied', 'happy', 'likely satisfied']
          const negTerms = ['dissatisfied', 'frustrated']
          let posCount = 0, negCount = 0
          satDist.forEach((i: any) => { const n = i.name.toLowerCase(); if (posTerms.some((t: string) => n.includes(t))) posCount += i.count; else if (negTerms.some((t: string) => n.includes(t))) negCount += i.count })
          const overallSentiment = posCount > negCount ? 'positive' : negCount > posCount ? 'negative' : 'mixed'

          // Peak period
          const periods: any = { Morning: { hours: [6,7,8,9,10,11], total: 0 }, Afternoon: { hours: [12,13,14,15,16,17], total: 0 }, Evening: { hours: [18,19,20,21,22,23], total: 0 }, Night: { hours: [0,1,2,3,4,5], total: 0 } }
          Object.entries(periods).forEach(([_, p]: any) => { p.total = p.hours.reduce((s: number, h: number) => s + (hourlyActivity[h.toString()] || 0), 0) })
          let peakPeriod = 'Morning', maxT = 0, peakHours = '6-11'
          Object.entries(periods).forEach(([name, p]: any) => { if (p.total > maxT) { maxT = p.total; peakPeriod = name; peakHours = Math.min(...p.hours) + '-' + Math.max(...p.hours) } })

          const profile = {
            generatedAt: new Date().toISOString(),
            identity: { totalMessages: stats.messages, totalSessions: stats.sessions, activeDays: stats.days, msgsPerDay: stats.msgsPerDay, dateRange },
            languages, primaryLanguage: languages[0]?.name || 'Unknown',
            tools, topTool: tools[0]?.name || 'Unknown',
            workStyle: { dominantSessionType: sessionTypeBreakdown[0]?.type || 'Unknown', sessionTypeBreakdown, avgResponseTime: responseTime, multiClauding },
            timePatterns: { hourlyActivity, peakPeriod, peakHours },
            goalCategories, topGoalCategory: goalCategories[0]?.name || 'Unknown',
            projectAreas,
            successProfile: { outcomes, successRate, whatHelpsMost },
            frictionProfile: { topFrictionTypes, categories: frictionCategories },
            satisfaction: { distribution: satDist, overallSentiment },
            strengths: bigWins.map((w: any) => w.title),
            weaknesses: frictionCategories.map((f: any) => f.title),
            keyInsight,
            claudeMdSuggestions,
            featureRecommendations: featureCards,
          }

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(profile))
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'Failed to generate profile' }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), insightsApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, '..', 'src'),
    },
  },
})
