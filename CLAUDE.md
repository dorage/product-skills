# product-skills

제품을 만드는 데 쓰는 역할별 Claude Code 플러그인 묶음(마켓플레이스) 리포다. 설치 방법과 플러그인 목록은 [README.md](README.md) 에 있다.

## 디렉터리

- `.claude-plugin/marketplace.json` - 이 리포가 내놓는 플러그인 목록
- `plugins/{플러그인}/` - 플러그인 하나. 설치할 때 이 폴더만 캐시로 복사된다
- `shared/` - 여러 플러그인이 함께 쓰는 파일. 처음 필요해질 때 만든다

## 플러그인을 나누는 기준

- 설치 단위는 역할(pm, design, dev 처럼 쓰는 사람)이다. 한 사람이 필요 없는 스킬까지 설치하게 되면 나눈다
- sdd 는 역할을 넘나드는 문서 흐름(요구사항 → 설계 → 구현 계획)이라 그대로 둔다. 새 역할 스킬이 생기면 그 역할 플러그인을 새로 만들고, sdd 를 쪼갤지는 그때 따로 정한다

## 플러그인을 더할 때

- `plugins/{이름}/.claude-plugin/plugin.json` 과 `skills/` 를 만든다
- `.claude-plugin/marketplace.json` 의 `plugins` 에 `"source": "./plugins/{이름}"` 으로 한 줄 더한다
- 루트 [README.md](README.md) 「플러그인」 표에 한 줄 더한다
- `claude plugin validate .` 으로 확인한다

## 여러 플러그인이 함께 쓰는 파일

설치하면 플러그인 폴더만 복사되므로, 스킬이 `../../shared/...` 처럼 플러그인 밖 파일을 가리키면 설치한 뒤에 깨진다.

- 원본은 `shared/` 에 하나만 둔다
- 쓰는 플러그인 안에 원본을 가리키는 심볼릭 링크를 둔다 (예: `plugins/pm/references/spec-format.md -> ../../../shared/spec-format.md`)
- 처음 쓸 때 실제로 설치해 보고, 캐시(`~/.claude/plugins/cache/product-skills/{플러그인}/`)에 링크가 아닌 실제 파일로 들어왔는지 확인한다

## 고친 뒤 반영하기

- 고친 플러그인의 `plugin.json` `version` 을 올린다. 문장만 고쳤으면 셋째 자리, 스킬을 더하거나 빼거나 이름을 바꿨으면 둘째 자리
- `/plugin update {플러그인}@product-skills` 를 실행하고 새 세션을 연다
