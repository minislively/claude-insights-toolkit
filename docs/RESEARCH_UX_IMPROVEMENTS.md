# Claude Insights Toolkit - UX 개선 리서치

> 본 문서는 cit collect 자동화, 오픈소스 활성화, 데이터 중복 문제에 대한 종합적인 리서치 결과입니다.

---

## 목차

0. [이미 구현된 기능 현황](#0-이미-구현된-기능-현황)
1. [cit collect 자동화 현황 분석](#1-cit-collect-자동화-현황-분석)
2. [오픈소스 적극 활용 전략](#2-오픈소스-적극-활용-전략)
3. [데이터 중복 문제 분석 및 UX 솔루션](#3-데이터-중복-문제-분석-및-ux-솔루션)
4. [수정된 구현 로드맵](#4-수정된-구현-로드맵)

---

## 0. 이미 구현된 기능 현황

> 본 리서치 수행 시점에서 이미 구현 완료된 기능 목록. 로드맵에서 중복 제안을 방지하기 위해 정리함.

| 기능 | 구현 파일 | 완성도 | 비고 |
|------|-----------|--------|------|
| 스마트 CLAUDE.md 제안 | `src/generators/claude-md.ts` | 100% | `cit suggest` 명령으로 사용 가능 |
| 생산성 분석 | `src/analyzers/productivity.ts` (417줄) | 80% | 점수 체계 확장만 필요 |
| 웹 대시보드 | `src/dashboard/` (7페이지, 2000+줄) | 90% | 프로덕션 서버 모드 미지원 |
| 코딩 스타일 프로필 | `src/analyzers/profile.ts` (425줄) | 100% | `cit profile` 명령으로 사용 가능 |
| 스냅샷 히스토리 | `src/commands/history.ts` | 100% | 이상 탐지(anomaly detection) 포함 |
| Git 기반 동기화 | `src/commands/sync.ts` | 90% | 멀티 디바이스 지원 |
| HTML 리포트 파싱 | `src/parsers/report.ts` (586줄) | 100% | report.html 자동 파싱 |

### 시사점

- 기존 P0 제안 4개 중 2개(스마트 CLAUDE.md, 생산성 점수)가 이미 80-100% 구현됨
- 웹 대시보드도 90% 완성이나 프로덕션 모드만 미지원
- **신규 기능보다 기존 기능의 안정화와 데이터 정확성이 우선**

---

## 1. cit collect 자동화 현황 분석

### 현재 상태: 기본적으로 수동

| 모드 | 작동 방식 | 사용자 부담 |
|------|-----------|-------------|
| **기본** | 수동 실행 (`cit collect`) | 매 세션 후 기억해서 실행해야 함 |
| **자동** | Claude Code 훅 설정 필요 | 3단계 복잡한 설정, `jq` 의존성, 경로 하드코딩 |

### 자동 수집 설정 방법 (docs/INSTALL.md)

```bash
# 1. 쉘 훅 생성
cat > ~/.claude/hooks/insights-auto-collect.sh << 'HOOK'
#!/bin/bash
# /insights 감지 시 자동 수집 로직
HOOK

# 2. settings.json에 등록
{
  "hooks": {
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "command",
        "command": "~/.claude/hooks/insights-auto-collect.sh",
        "timeout": 5000
      }]
    }]
  }
}
```

### 설계상 UX 마찰

| 단계 | 사용자 행동 필요 | 리스크 |
|------|------------------|--------|
| 1. 세션 종료 후 | `/insights` 실행 기억 | 데이터 미생성 |
| 2. 터미널 전환 | `cit collect` 실행 기억 | 7일 내 미수집 시 데이터 소실 |
| 3. 멀티 디바이스 | `cit sync` 실행 기억 | 데이터 불일치 |

### 핵심 문제: 7일 데이터 소실 윈도우

```
Claude Code /insights → ~/.claude/usage-data/facets/ → 7일 후 자동 삭제
                                ↓
                        cit collect (수동 실행 필요)
                                ↓
                    ~/claude-insights/data/ (영구 저장)
```

### 자동 수집 대안 비교 분석

| 방식 | 종합 점수 | 즉시성 | 크로스 플랫폼 | 사용자 마찰 | 구현 복잡도 |
|------|----------|--------|--------------|------------|------------|
| **파일 워처 (chokidar)** | 7/10 | 즉각 수집 | macOS/Linux/Windows | 낮음 (데몬 자동 시작) | 중간 |
| **npm postinstall 자동 설정** | 7/10 | 설치 시 구성 | 전체 | 최소 (자동) | 중간 |
| **Launchd/systemd** | 6/10 | OS 스케줄링 | macOS/Linux만 | 중간 | 높음 (플랫폼별) |
| **Cron Job** | 5/10 | 최대 1시간 지연 | Unix 계열 | 중간 | 낮음 |
| **Claude Code 훅 (현재)** | 4/10 | 이벤트 기반 | 전체 | 높음 (3단계 수동) | 낮음 |
| **쉘 프로필 훅** | 3/10 | 터미널 시작 시 | Unix 계열 | 중간 | 낮음 |

### 권장 접근: 하이브리드 전략

```
우선순위 체인:
1. 파일 워처 (chokidar) → 즉각 수집, 최상의 UX
2. Claude Code 훅 (개선) → 이벤트 기반, 데몬 불필요
3. Cron (시간별) → 범용 폴백
4. 수동 리마인더 → 항상 사용 가능
```

**구현 계획:**
- `cit setup` 위저드: 플랫폼 자동 감지 후 최적 방식 추천
- `cit daemon start/stop`: chokidar 기반 파일 감시 데몬
- `cit setup hooks`: jq 의존성 제거, Node.js 기반 파서로 교체
- `cit status --auto-collection`: 현재 자동 수집 상태 진단

---

## 2. 오픈소스 적극 활용 전략

### P0: 핵심 기능 (즉시 임팩트)

| 기능 | 사용자 가치 | 긴급도 근거 |
|------|------------|-------------|
| **데이터 중복 제거** | 모든 분석 결과의 정확성 보장 | `bottleneck.ts:58`, `trends.ts:48`에서 중복 미처리 확인됨 |
| **자동 수집 개선** | 7일 데이터 소실 방지, 설정 마찰 제거 | 현재 3단계 수동 설정, jq 의존성 |
| **프로덕션 웹서버 모드** | 대시보드를 일반 사용자도 접근 가능하게 | 현재 개발 모드만 지원 |

### P1: 생태계 구축

| 기능 | 사용자 가치 | 참여 유발 요소 |
|------|------------|----------------|
| **🔧 플러그인 시스템** | 커스텀 분석기 작성 | 파워 유저가 기여자로 전환 |
| **📚 커뮤니티 패턴 저장소** | 검증된 CLAUDE.md 템플릿 공유 | 크라우드소싱 지식 축적 |
| **🚀 GitHub Actions 통합** | 팀 단위 생산성 분석 | 엔터프라이즈 도입 |
| **🎯 개발자 생산성 점수** | "당신의 Claude Code 점수: 847/1000" | 경쟁심 + 성취욕구 |
| **🔌 VS Code 확장** | 에디터 안에서 인사이트 확인 | 매일 보이는 접근성 |
| **🤖 스마트 CLAUDE.md** | 마찰 패턴 감지 시 자동 업데이트 제안 | 즉각적 실질 가치 (이미 `cit suggest`로 구현됨) |
| **📧 주간 다이제스트** | "지난주보다 15% 더 생산적!" | 정기적 접점, 게임화 |

### P2-P3: 고급 기능

- **실시간 세션 코치** - 패턴 기반 즉각적 가이드
- **퍼블릭 프로필** - Claude Code 여정 공유
- **챌린지 모드** - 게임화된 주간 챌린지
- **예측 경고** - ML 기반 마찰 예측

### 성공 지표 (측정 가능 기준)

> 텔레메트리 없이 측정 가능한 지표만 포함. 사용자 신뢰 우선.

| 지표 | 현재 (baseline) | 목표 (v0.2) | 측정 방법 |
|------|----------------|-------------|-----------|
| npm 주간 설치 수 | 0 | 50+ | npm stats (공개 API) |
| GitHub 스타 | 0 | 20+ | GitHub API |
| 설치 소요 시간 | ~10분 (수동 3단계) | <2분 (`cit setup`) | 사용자 테스트 |
| 데이터 중복률 | ~54% (추정) | 0% | `cit doctor` 검증 |
| 첫 외부 PR | - | 출시 2주 내 | GitHub 데이터 |
| 문서 완성도 | 70% | 90%+ | 체크리스트 기반 |
| 테스트 커버리지 | 22% | 60%+ | Jest --coverage |

**의도적 제외 항목:**
- ~~DAU 3배 증가~~: 현재 baseline 없음, 텔레메트리 미구축
- ~~세션 수집률~~: 측정 인프라 없음
- ~~CLAUDE.md 업데이트율~~: 추적 불가
- ~~7/30/90일 유지율~~: 텔레메트리 필요

> v1.0 이전에는 텔레메트리를 추가하지 않음. 신규 프로젝트는 추적보다 신뢰가 우선.

---

## 3. 데이터 중복 문제 분석 및 UX 솔루션

### 문제 상황

```
1일: /insights → sessions [A, B, C] 저장
2일: /insights → sessions [B, C, D] 저장 (B, C 중복!)
3일: /insights → sessions [C, D, E] 저장 (C, D 중복!)

30일 분석 시: 동일 세션이 여러 날에 걸쳐 중복 계산됨
```

### 원인 분석

- `stat.mtime` (파일 수정 시간)으로 날짜 할당
- 세션이 여러 날에 걸쳐 수집되면 중복 발생
- `session_id` 기반 중복 제거 없음

### 영향

- **트렌드 왜곡**: 수집 패턴에 따른 인위적 증가/감소
- **세션 수 과대 계산**: 동일 세션이 여러 번 계산
- **병목 분석 부정확**: 실제보다 많은 마찰 지점 표시

### UX 솔루션

#### A. 세션 기반 저장소 구조 (권장)

```
~/claude-insights/
  sessions/              ← 고유 세션 저장 (session_id 기반)
    sess-abc.json
    sess-def.json
  daily-index/           ← 날짜별 세션 ID 목록 (참조만)
    2025-02-01.json      ← ["sess-abc", "sess-def"]
```

#### B. 두 가지 분석 모드 제공

```bash
# 기본: 중복 제거된 고유 세션 분석
cit analyze --days 30

# 고급: 수집 시점 기준 원본 데이터
cit analyze --days 30 --raw
```

#### C. 데이터 품질 표시기

```
📊 분석 결과
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 분석 기간: 30일
🔑 고유 세션: 145개
⚠️  중복 세션: 23개 (여러 날에 걸쳐 수집됨)
✅ 처리 방식: 중복 제거 후 분석됨

💡 팁: `cit doctor`로 데이터 무결성 검사
```

#### D. 시각적 타임라인

```
세션 활동 타임라인
══════════════════════════════════════════

2월 1일  ████░░░░░░░░░░░░░░░░  4개
2월 2일  ████████░░░░░░░░░░░░  8개
2월 3일  ██████░░░░░░░░░░░░░░  6개
...
2월 28일 ██████████░░░░░░░░░░  10개

총 고유 세션: 145개
데이터 상태: ✅ 깨끗함
```

#### E. 데이터 무결성 명령어 (cit doctor)

```bash
$ cit doctor

🔍 데이터 건강 검진
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
총 스냅샷: 30일
총 세션 참조: 320개
고유 세션: 145개
중복률: 54% (175개 중복 참조)

⚠️  발견된 문제:
   • 23개 세션이 2개 이상의 날짜에 존재
   • 5개 세션이 동일한 내용으로 반복 수집됨

💡 권장 조치:
   1. cit collect --repair  (저장소 재구성)
   2. cit analyze --dedupe  (일회성 중복 제거)
```

---

## 4. 수정된 구현 로드맵

> 코드베이스 검증 결과를 반영한 현실적 로드맵. 기존 구현을 활용하고 기반 안정화를 우선함.

### Phase 1: 기반 안정화 (P0) - 3.5주

| 항목 | 기간 | 대상 파일 | 설명 |
|------|------|-----------|------|
| 데이터 중복 제거 | 1.5주 | `bottleneck.ts`, `trends.ts`, `facets.ts` | session_id 기반 dedup 로직 추가 |
| 자동 수집 개선 | 1주 | 신규: `src/daemon/`, `src/setup/` | `cit setup` 위저드 + 파일 워처 |
| 프로덕션 웹서버 | 1주 | `src/dashboard/` | 정적 빌드 + 서버 모드 추가 |

### Phase 2: 품질 강화 (P1) - 3주

| 항목 | 기간 | 대상 파일 | 설명 |
|------|------|-----------|------|
| cit doctor 명령어 | 2주 | `src/cli.ts`, 신규: `src/commands/doctor.ts` | 데이터 무결성 검사 + 자동 복구 |
| 주간 다이제스트 | 1주 | 신규: `src/generators/digest.ts` | 로컬 터미널 출력 (이메일 인프라 불필요) |

### Phase 3: 기존 기능 확장 (P1) - 2주

| 항목 | 기간 | 대상 파일 | 설명 |
|------|------|-----------|------|
| 생산성 점수 체계 | 2주 | `src/analyzers/productivity.ts` | 기존 분석에 점수 산출 로직 추가 |

### Phase 4: 확장 기능 (P2) - 채택 검증 후 조건부 진행

> 게이트 조건: npm 주간 설치 50+, GitHub 스타 20+, 외부 PR 5+

| 항목 | 예상 기간 | 설명 |
|------|----------|------|
| VS Code 확장 | 6-8주 | 채택 검증 후에만 진행 |
| 플러그인 시스템 | 8-16주 | 커뮤니티 수요 확인 후 진행 |

### 기존 vs 수정 로드맵 비교

| 항목 | 기존 추정 | 수정 추정 | 변경 사유 |
|------|----------|----------|-----------|
| 생산성 점수 + 다이제스트 | 2주 | 3주 (Phase 2-3) | 기존 코드 활용으로 단축, but 품질 확보 |
| 데이터 중복 제거 | 2주 (P1) | 1.5주 (**P0로 격상**) | 모든 분석 정확성의 전제조건 |
| cit doctor | 2주 | 2주 | 동일 |
| VS Code 확장 | 4주 | 6-8주 (**조건부**) | 별도 프로젝트급, 채택 검증 필요 |
| 플러그인 시스템 | 4주+ | 8-16주 (**조건부**) | 초기 추정 대비 200% 과소평가 |
| **합계** | **14주** | **8.5주 (확정) + 14-24주 (조건부)** | 확정 작업량 39% 감소 |

### 핵심 파일 변경 (우선순위순)

| 파일 | 변경 내용 | 우선순위 |
|------|-----------|----------|
| `src/analyzers/bottleneck.ts` | L58: session_id 기반 중복 제거 추가 | **P0** |
| `src/analyzers/trends.ts` | L48: 중복 제거 후 트렌드 계산 | **P0** |
| `src/collectors/facets.ts` | 세션 중심 저장 모델 전환 | **P0** |
| 신규: `src/setup/index.ts` | `cit setup` 자동 구성 위저드 | **P0** |
| 신규: `src/daemon/watcher.ts` | chokidar 기반 파일 감시 | **P0** |
| `src/cli.ts` | `cit doctor`, `cit setup`, `cit daemon` 추가 | P1 |
| `src/utils/storage.ts` | 미구현 함수 10개 완성 또는 제거 | P1 |
| `src/analyzers/productivity.ts` | 점수 산출 체계 추가 | P1 |

---

## 부록: 중복 제거 알고리즘 의사코드

```typescript
// 분석 전 중복 제거 함수
function deduplicateSessions(insightsDays: IInsightsDay[]): ISessionFacet[] {
  const sessionMap = new Map<string, ISessionFacet>();

  for (const day of insightsDays) {
    for (const session of day.sessions) {
      const existing = sessionMap.get(session.session_id);

      if (!existing) {
        // 처음 보는 세션: 저장
        sessionMap.set(session.session_id, session);
      } else {
        // 중복 세션: 마찰 데이터 병합 (union)
        existing.friction_counts = mergeFrictionCounts(
          existing.friction_counts,
          session.friction_counts
        );
      }
    }
  }

  return Array.from(sessionMap.values());
}

// 사용 예시
const uniqueSessions = deduplicateSessions(insightsDays);
const analysis = analyzeBottlenecks(uniqueSessions); // 중복 없이 분석
```

---

## Appendix A: Claude Code `/insights` 사용자 사용 패턴 리서치 요약 (외부 레퍼런스)

> 목적: 툴킷이 해결하려는 문제(7일 소실, 수동 분석 번거로움, 액션 부족)가 실제 사용자 경험에서 어떻게 나타나는지 확인.

### 사람들이 `/insights`를 실제로 쓰는 방식(반복 패턴)

1) **주간 회고/패턴 교정(가장 흔함)**
- 주 1회 실행 → 병목(마찰)과 성공 패턴 확인 → 다음 주 규칙 1~2개만 적용
- 의사결정 예: “디버깅은 재현-가설-검증 루프 강제”, “복잡한 변경은 접근 검증 먼저”

2) **문제 터졌을 때 진단(원인 분리)**
- “이번 주 왜 안 풀렸지?” 시점에 API 에러/반복 루프/시간대 영향 등을 확인

3) **자기 코칭(프롬프트/태도/작업 습관 교정)**
- 보고서가 ‘로스팅(roast)’처럼 느껴질 수 있으나, 실제로는 행동 변화 유도 계기로 언급됨

4) **팀/운영 참고(간접)**
- 조직 단위 analytics(콘솔/API)와 같이 보며 개인 습관 + 팀 지표를 연결

### 보고되는 실질 효과(체감 포인트)
- **비효율 루프 인지**: 같은 문제로 왕복하는 패턴을 ‘수치/증거’로 확인
- **작업 시작 품질 개선**: 목표/제약/완료조건(AC) 명시 습관 강화
- **우선순위 조정**: 어떤 작업 유형이 실제로 효율이 나오는지 판단
- **회고 객관화**: 감이 아닌 기록 기반 주간 리뷰가 가능해짐

### 단점/불편/피드백(반복적으로 언급)
- **지표 왜곡 가능성**: 긴 세션, 브라우저 자동화/특수 작업이 지표를 크게 왜곡
- **실행 비용/무거움**: `/insights` 실행이 부담스럽게 느껴진다는 경험담
- **피드백 피로감**: 반복적 피드백 프롬프트/경고가 집중을 깬다는 불만
- **해석 난이도**: “그래서 뭘 바꾸면 되지?”까지 자동으로 이어지지 않음 → 템플릿/루틴이 필요

### Toolkit에 대한 시사점(제품 관점)
- **데이터 품질/신뢰가 1순위**: 중복 제거, ‘왜곡 가능성’ 표시(롱 세션, 자동화 세션) 같은 가드레일 필요
- **액션 변환이 핵심 가치**: 원인 TOP2 + 다음 주 액션 2개로 강제 요약(사용자 피로 감소)
- **무거운 실행을 대체할 CLI 요약**: 주간 다이제스트/스냅샷 기반 요약을 우선 제공하면 재방문률에 유리

### Sources (외부 레퍼런스)
- https://docs.anthropic.com/en/docs/claude-code/cli-reference
- https://docs.anthropic.com/en/docs/claude-code/analytics
- https://docs.anthropic.com/en/docs/claude-code/monitoring-usage
- https://www.natemeyvis.com/claude-codes-insights/
- https://www.zolkos.com/2026/02/04/deep-dive-how-claude-codes-insights-command-works.html
- https://jangwook.net/en/blog/en/claude-code-insights-usage-analysis/
- https://www.reddit.com/r/ClaudeCode/comments/1r15ca9/insights_is_great_thanks_to_whomever_mentioned_it/
- https://www.reddit.com/r/ClaudeCode/comments/1r36osf/claude_code_insights/
- https://github.com/anthropics/claude-code/issues/8036
- https://github.com/anthropics/claude-code/issues/9239

## 참고 자료

- [INSTALL.md](./INSTALL.md) - 자동 수집 설정 가이드
- [ARCHITECTURE.md](./ARCHITECTURE.md) - 시스템 아키텍처
- [API.md](./API.md) - 프로그래밍 API 문서

---

*문서 작성일: 2026-02-08*
*연구 주제: UX 개선, 코드베이스 검증, 현실적 로드맵 수립*
