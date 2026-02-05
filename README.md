# Claude Insights Toolkit

[![npm version](https://img.shields.io/npm/v/claude-insights-toolkit.svg)](https://www.npmjs.com/package/claude-insights-toolkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/node/v/claude-insights-toolkit.svg)](https://nodejs.org)

> Open-source toolkit for Claude Code insights analysis, bottleneck detection, and CLAUDE.md optimization

[English](#english) | [한국어](#한국어)

---

## English

### 🎯 What Problem Does This Solve?

Claude Code's `/insights` command provides powerful productivity data, but:
- **Data is lost after 7 days** - You can't track long-term trends
- **Manual analysis is tedious** - Hard to spot patterns in raw JSON
- **No actionable guidance** - You know there's friction, but how to fix it?

**Claude Insights Toolkit** automatically:
1. ✅ Collects and stores `/insights` data (30+ days history)
2. ✅ Detects bottleneck patterns in your workflow
3. ✅ Auto-generates CLAUDE.md improvement suggestions
4. ✅ Tracks productivity trends over time

### 🚀 Quick Start

#### Installation

**Global install (recommended):**
```bash
npm install -g claude-insights-toolkit
```

**Or use without installing:**
```bash
npx claude-insights-toolkit collect
```

#### Basic Usage

```bash
# Collect today's insights data
cit collect

# Analyze bottlenecks from last 7 days
cit analyze

# Generate CLAUDE.md suggestions
cit suggest

# View productivity trends
cit trend --days 30
```

#### Multi-Device Sync Setup

**First Computer (Initial Setup):**
```bash
# 1. Authenticate with GitHub CLI (if not already)
gh auth login

# 2. Initialize sync (auto-creates private repo)
cit init-sync

# 3. Collect all historical data
cit collect --all

# 4. Push to remote
cit sync
```

**New Computer (Clone Existing Data):**
```bash
# 1. Authenticate with GitHub CLI
gh auth login

# 2. Clone your insights data
cit clone https://github.com/your-username/claude-insights-data

# 3. Keep syncing after each session
cit sync
```

**Daily Workflow:**
```bash
# After each Claude Code session
cit collect && cit sync
```

### 📦 CLI Commands

#### Data Collection & Analysis

| Command | Description | Options |
|---------|-------------|---------|
| `cit collect` | Collect insights from `~/.claude/usage-data/facets/` | `--date YYYY-MM-DD`, `--all` |
| `cit analyze` | Detect bottleneck patterns | `--days N`, `--output json` |
| `cit suggest` | Generate CLAUDE.md improvements | `--category friction\|goal` |
| `cit trend` | Show productivity trend charts | `--days N`, `--metric sessions\|time` |

#### Multi-Device Sync

| Command | Description | Options |
|---------|-------------|---------|
| `cit init-sync` | Initialize sync with auto-created private GitHub repo | `--name <repo-name>` |
| `cit clone <url>` | Clone insights data to a new computer | - |
| `cit sync` | Sync data across devices (commit + pull + push) | - |
| `cit pull` | Pull latest data from remote | - |
| `cit push` | Push local data to remote | - |
| `cit remote add <url>` | Manually add remote repository | - |

### 📊 Example Output

```bash
$ cit analyze --days 7

🔍 Bottleneck Analysis (Last 7 Days)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  TOP FRICTION POINTS:
  1. Missing context (12 occurrences)
     → Average session time: 45min
     → Suggested fix: Add architecture overview to CLAUDE.md

  2. Unexpected behavior (8 occurrences)
     → 80% involved API integrations
     → Suggested fix: Document API patterns in CLAUDE.md

📈 TREND: Friction decreased 20% since last week
✨ Run 'cit suggest' to auto-generate CLAUDE.md updates
```

### 🛠️ Development Setup

```bash
# Clone repository
git clone https://github.com/yourusername/claude-insights-toolkit.git
cd claude-insights-toolkit

# Install dependencies
npm install

# Run in development mode
npm run dev -- collect

# Build for production
npm run build

# Run tests
npm test
```

### 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Setting up dev environment
- Code style guidelines
- How to add new analyzers
- PR process

### 📝 License

MIT License - see [LICENSE](./LICENSE) file

### 🌟 Roadmap

- [ ] Web dashboard for visualizing trends
- [ ] Integration with CI/CD for team analytics
- [ ] AI-powered recommendation engine
- [ ] Export reports to Notion/Slack
- [ ] Plugin marketplace for custom analyzers

---

## 한국어

### 🎯 어떤 문제를 해결하나요?

Claude Code의 `/insights` 명령어는 강력한 생산성 데이터를 제공하지만:
- **7일 후 데이터 소실** - 장기 트렌드 추적 불가
- **수동 분석의 번거로움** - 원시 JSON 데이터에서 패턴 파악이 어려움
- **실행 가능한 가이드 부재** - 마찰 지점은 알지만 해결 방법을 모름

**Claude Insights Toolkit**은 자동으로:
1. ✅ `/insights` 데이터를 수집하고 저장 (30일 이상 히스토리)
2. ✅ 워크플로우의 병목 지점 패턴 감지
3. ✅ CLAUDE.md 개선 제안 자동 생성
4. ✅ 시간 경과에 따른 생산성 트렌드 추적

### 🚀 빠른 시작

#### 설치

**전역 설치 (권장):**
```bash
npm install -g claude-insights-toolkit
```

**또는 설치 없이 사용:**
```bash
npx claude-insights-toolkit collect
```

#### 기본 사용법

```bash
# 오늘의 인사이트 데이터 수집
cit collect

# 최근 7일의 병목 지점 분석
cit analyze

# CLAUDE.md 개선 제안 생성
cit suggest

# 생산성 트렌드 보기
cit trend --days 30
```

#### 멀티 디바이스 동기화 설정

**첫 번째 컴퓨터 (초기 설정):**
```bash
# 1. GitHub CLI 인증 (아직 안 했다면)
gh auth login

# 2. 동기화 초기화 (자동으로 비공개 저장소 생성)
cit init-sync

# 3. 모든 히스토리 데이터 수집
cit collect --all

# 4. 원격에 푸시
cit sync
```

**새 컴퓨터 (기존 데이터 복제):**
```bash
# 1. GitHub CLI 인증
gh auth login

# 2. 인사이트 데이터 복제
cit clone https://github.com/your-username/claude-insights-data

# 3. 세션 후 계속 동기화
cit sync
```

**일일 워크플로우:**
```bash
# 각 Claude Code 세션 후
cit collect && cit sync
```

### 📦 CLI 명령어

#### 데이터 수집 & 분석

| 명령어 | 설명 | 옵션 |
|-------|------|------|
| `cit collect` | `~/.claude/usage-data/facets/`에서 인사이트 수집 | `--date YYYY-MM-DD`, `--all` |
| `cit analyze` | 병목 지점 패턴 감지 | `--days N`, `--output json` |
| `cit suggest` | CLAUDE.md 개선 사항 생성 | `--category friction\|goal` |
| `cit trend` | 생산성 트렌드 차트 표시 | `--days N`, `--metric sessions\|time` |

#### 멀티 디바이스 동기화

| 명령어 | 설명 | 옵션 |
|-------|------|------|
| `cit init-sync` | 자동으로 비공개 GitHub 저장소 생성 및 동기화 초기화 | `--name <repo-name>` |
| `cit clone <url>` | 새 컴퓨터에 인사이트 데이터 복제 | - |
| `cit sync` | 디바이스 간 데이터 동기화 (commit + pull + push) | - |
| `cit pull` | 원격에서 최신 데이터 가져오기 | - |
| `cit push` | 로컬 데이터를 원격에 푸시 | - |
| `cit remote add <url>` | 수동으로 원격 저장소 추가 | - |

### 📊 출력 예시

```bash
$ cit analyze --days 7

🔍 병목 지점 분석 (최근 7일)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  주요 마찰 지점:
  1. 누락된 컨텍스트 (12회 발생)
     → 평균 세션 시간: 45분
     → 제안: CLAUDE.md에 아키텍처 개요 추가

  2. 예상치 못한 동작 (8회 발생)
     → 80%가 API 통합 작업
     → 제안: CLAUDE.md에 API 패턴 문서화

📈 트렌드: 지난주 대비 마찰 20% 감소
✨ 'cit suggest' 실행 시 CLAUDE.md 자동 업데이트 생성
```

### 🛠️ 개발 환경 설정

```bash
# 저장소 클론
git clone https://github.com/yourusername/claude-insights-toolkit.git
cd claude-insights-toolkit

# 의존성 설치
npm install

# 개발 모드로 실행
npm run dev -- collect

# 프로덕션 빌드
npm run build

# 테스트 실행
npm test
```

### 🤝 기여하기

기여를 환영합니다! 자세한 내용은 [CONTRIBUTING.md](./CONTRIBUTING.md)를 참고하세요:
- 개발 환경 설정
- 코드 스타일 가이드
- 새 분석기 추가 방법
- PR 프로세스

### 📝 라이선스

MIT 라이선스 - [LICENSE](./LICENSE) 파일 참고

### 🌟 로드맵

- [ ] 트렌드 시각화를 위한 웹 대시보드
- [ ] 팀 분석을 위한 CI/CD 통합
- [ ] AI 기반 추천 엔진
- [ ] Notion/Slack으로 리포트 내보내기
- [ ] 커스텀 분석기를 위한 플러그인 마켓플레이스

---

**Star ⭐ this project if you find it useful!**
