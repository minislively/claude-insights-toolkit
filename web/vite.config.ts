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
