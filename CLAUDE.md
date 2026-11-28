# product-skills

제품을 만드는 데 쓰는 역할별 Claude Code 플러그인 묶음(마켓플레이스) 리포다. 설치 방법과 플러그인 목록은 [README.md](README.md) 에 있다.

## 디렉터리

- `.claude-plugin/marketplace.json` - 이 리포가 내놓는 플러그인 목록
- `plugins/{플러그인}/` - 플러그인 하나. 다른 리포에서 설치할 때 이 폴더만 캐시로 복사된다
- `plugins/{플러그인}/principles/` - 그 플러그인의 스킬이 지키는 원칙. 원칙 하나가 파일 하나다 (「스킬이 지키는 원칙」)
- `plugins/{플러그인}/PRINCIPLE.md` - 그 플러그인에 어떤 원칙이 있는지 적은 목록
- `principles/` - 여러 플러그인이 함께 쓰는 원칙의 원본. 플러그인은 링크로 가리킨다 (「스킬이 지키는 원칙」)
- `shared/` - 여러 플러그인이 함께 쓰는 그 밖의 파일. 처음 필요해질 때 만든다
- `scripts/update.ts` - 설치한 플러그인(스킬 포함)과 product CLI 를 한 번에 최신으로 올리는 스크립트. 실행 명령은 [README.md](README.md) 「최신으로 올리기」에 있다
- `.claude/settings.json` - 이 리포 안에서 지금 브랜치의 플러그인을 쓰게 하는 설정 (「이 리포에서 플러그인 쓰기」)

## 이 리포에서 플러그인 쓰기

이 리포는 설치한 캐시 사본이 아니라 지금 브랜치의 `plugins/` 를 그대로 플러그인으로 쓴다. 플러그인을 고치면 이 리포에서는 바로 최신 내용이 쓰인다.

- `.claude/settings.json` 이 리포 맨 위(`"path": "."`)를 폴더 마켓플레이스 `product-skills` 로 등록하고, `enabledPlugins` 로 플러그인을 켠다
- 폴더 마켓플레이스 안의 플러그인은 캐시로 복사되지 않고 그 자리에서 읽힌다. 고친 내용은 새 세션을 열거나 `/reload-plugins` 를 실행하면 반영되고, 버전을 올리거나 `/plugin update` 를 하지 않아도 된다
- `.` 은 Claude Code 를 연 폴더로 풀린다(메인 체크아웃에서 확인했다). 워크트리에서 열면 그 워크트리의 `plugins/` 를 쓰는 것으로 본다. 워크트리에서는 아직 확인하지 않았다
- 리포 설정은 폴더 신뢰를 받은 뒤에만 먹는다. 새 워크트리 폴더에서 처음 열 때 신뢰 질문에 한 번 답한다. 위 폴더를 신뢰한 것으로는 부족하다
- 처음 여는 세션은 마켓플레이스를 등록만 하고 플러그인을 못 읽을 수 있다. 스킬이 안 보이면 `/reload-plugins` 를 실행하거나 새 세션을 연다
- 같은 스킬을 다른 마켓플레이스에서도 켜 두었으면(예: 사용자 설정의 `sdd@dotfiles`) 둘 다 올라간다. 이 리포에서 끄려면 `.claude/settings.local.json` 의 `enabledPlugins` 에 `false` 로 적는다. 이 파일은 커밋하지 않아서 새 워크트리에는 따라오지 않는다. 워크트리마다 따로 만든다

## 플러그인을 나누는 기준

- 설치 단위는 역할(pm, design, dev 처럼 쓰는 사람)이다. 한 사람이 필요 없는 스킬까지 설치하게 되면 나눈다
- product 는 역할을 넘나드는 문서 흐름(요구사항 → 설계 → 구현 계획)이라 그대로 둔다. 새 역할 스킬이 생기면 그 역할 플러그인을 새로 만들고, product 를 쪼갤지는 그때 따로 정한다

## 플러그인을 더할 때

- `plugins/{이름}/.claude-plugin/plugin.json` 과 `skills/` 를 만든다
- `plugins/{이름}/PRINCIPLE.md` 를 만든다. `principles/` 는 첫 원칙 파일을 쓸 때 함께 생긴다 (「스킬이 지키는 원칙」)
- `.claude-plugin/marketplace.json` 의 `plugins` 에 `"source": "./plugins/{이름}"` 으로 한 줄 더한다
- 루트 [README.md](README.md) 「플러그인」 표에 한 줄 더한다
- `.claude/settings.json` 의 `enabledPlugins` 에 `"{이름}@product-skills": true` 를 더한다. 이 리포에서 그 플러그인을 바로 쓰기 위해서다
- `claude plugin validate .` 으로 확인한다

## 스킬이 지키는 원칙

모든 스킬은 자기가 지켜야 할 원칙을 `SKILL.md` 에 풀어 쓰지 않고, 자기 플러그인의 `principles/` 에 정리한다. 원칙이 스킬 문서마다 흩어지면 어떤 원칙이 있는지 한눈에 볼 수 없고, 같은 원칙을 여러 곳에서 고쳐야 한다.

- 원칙의 내용은 `plugins/{플러그인}/principles/` 에만 쓴다. 원칙 하나가 파일 하나이고, 파일 이름은 원칙을 줄인 영어 소문자와 `-` 로 짓는다 (예: `conclusion-first.md`)
- 어떤 원칙이 있는지는 `plugins/{플러그인}/PRINCIPLE.md` 에 적는다. 원칙마다 파일 이름과 한 문장 요약을 한 줄로 쓴다
- `PRINCIPLE.md` 에는 목록만 둔다. 원칙의 설명과 예시는 원칙 파일에 있다
- 스킬은 `SKILL.md` 에 자기가 지키는 원칙을 파일 이름으로 가리키기만 하고, 내용을 다시 쓰지 않는다
- 원칙을 더하거나 빼거나 이름을 바꾸면 같은 커밋에서 `PRINCIPLE.md` 의 줄도 고친다. `principles/` 의 파일과 `PRINCIPLE.md` 의 줄은 하나씩 짝이 맞아야 한다
- 원칙 파일은 플러그인 폴더 안에 둔다. 설치하면 플러그인 폴더만 복사되기 때문이다. 여러 플러그인이 같은 원칙을 쓰면 원본을 리포 맨 위 `principles/` 에 하나만 두고, 쓰는 플러그인의 `principles/` 에 원본을 가리키는 심볼릭 링크를 둔다 (예: `plugins/product/principles/polish-tool.md -> ../../../principles/polish-tool.md`). 링크도 그 플러그인의 `PRINCIPLE.md` 에 한 줄로 적는다. 설치 뒤 확인은 「여러 플러그인이 함께 쓰는 파일」을 따른다

## 여러 플러그인이 함께 쓰는 파일

설치하면 플러그인 폴더만 복사되므로, 스킬이 `../../shared/...` 처럼 플러그인 밖 파일을 가리키면 설치한 뒤에 깨진다.

- 원본은 `shared/` 에 하나만 둔다
- 쓰는 플러그인 안에 원본을 가리키는 심볼릭 링크를 둔다 (예: `plugins/pm/references/spec-format.md -> ../../../shared/spec-format.md`)
- 처음 쓸 때 다른 리포에서 GitHub 마켓플레이스로 실제로 설치해 보고, 캐시(`~/.claude/plugins/cache/product-skills/{플러그인}/`)에 링크가 아닌 실제 파일로 들어왔는지 확인한다. 이 리포 안에서는 그 자리에서 읽어서, 설치한 뒤에만 깨지는 경로(플러그인 밖 파일을 가리키는 경로)가 드러나지 않는다

## 고친 뒤 반영하기

- 이 리포 안: 새 세션을 열거나 `/reload-plugins` 를 실행한다 (「이 리포에서 플러그인 쓰기」)
- 다른 리포(GitHub 마켓플레이스로 설치한 곳): 고친 플러그인의 `plugin.json` `version` 을 올린다. 문장만 고쳤으면 셋째 자리, 스킬을 더하거나 빼거나 이름을 바꿨으면 둘째 자리. 머지된 뒤 그 리포에서 `/plugin update {플러그인}@product-skills` 를 실행하고 새 세션을 연다
