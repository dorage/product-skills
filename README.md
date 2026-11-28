# product-skills

제품을 만드는 데 쓰는 Claude Code 플러그인 묶음(마켓플레이스)이다. PM·디자인·개발 스킬을 역할별 플러그인으로 나눠 두고, 쓰는 사람은 자기에게 필요한 플러그인만 설치한다.

## 플러그인

| 플러그인 | 쓰는 사람 | 하는 일 |
| --- | --- | --- |
| [product](plugins/product/README.md) | 기획·개발 | 요구사항 → 설계 → 화면흐름 → 구현 계획 → 테스트 시나리오를 문서로 쓰는 스펙 주도 개발 스킬 |
| [report](plugins/report/README.md) | 보고하는 사람 | 자료와 주장을 가로 16:9 발표 자료 PDF 로 만드는 스킬, 커밋·PR 로 기간·기능 단위 진행 보고 PDF 를 만드는 스킬, 그 스킬이 따르는 원칙 문서 |

## 설치

필요한 플러그인만 골라 설치한다. 마켓플레이스 등록도 함께 된다.

```
/plugin install product --marketplace dorage/product-skills
```

- 내 모든 리포에서 쓰기: 위 명령 그대로. 이미 마켓플레이스를 등록했으면 `/plugin install product@product-skills`
- 이 리포에서만 쓰기: `claude plugin install product@product-skills --scope project`. 리포의 `.claude/settings.json` 에 기록되어 같은 리포를 쓰는 팀원에게도 켜진다

플러그인을 나눠 두는 이유는 상시 비용이다. 설치된 스킬의 설명은 모든 세션에 항상 들어간다. product 스킬 10개만으로 세션마다 약 3,270 토큰이다(`claude plugin details product@product-skills`). 쓰지 않는 역할의 스킬까지 설치하면 그만큼 모든 세션이 무거워진다.

## 최신으로 올리기

마켓플레이스 목록, 설치한 플러그인(스킬 포함), product CLI(`@dorage/product`)를 명령 하나로 최신으로 올린다. 올린 뒤 새 세션을 열어야 적용된다.

```
curl -fsSL https://raw.githubusercontent.com/dorage/product-skills/main/scripts/update.ts -o /tmp/product-skills-update.ts && npx -y tsx /tmp/product-skills-update.ts
```

- 이 리포를 받아 두었으면: `npx tsx scripts/update.ts`
- 바꾸지 않고 무엇을 올릴지만 보기: 끝에 `--dry-run` 을 붙인다
- 한 단계가 실패해도 나머지는 진행하고, 실패한 줄을 `✘` 로 보여 준다
- 윤문 도구(`humanize-korean@im-not-ai`)는 이 리포가 내놓는 것이 아니라서 올리지 않는다

## 구조

```
product-skills/
├── .claude-plugin/marketplace.json   ← 플러그인 목록
├── scripts/update.ts                 ← 플러그인·스킬·CLI 를 한 번에 올리는 스크립트
├── principles/                       ← 여러 플러그인이 함께 쓰는 원칙의 원본
├── shared/                           ← 여러 플러그인이 함께 쓰는 파일 (필요해지면 만든다)
└── plugins/
    └── {플러그인}/
        ├── .claude-plugin/plugin.json
        ├── skills/
        └── references/
```

플러그인을 더하는 규칙은 [CLAUDE.md](CLAUDE.md) 에 있다.
