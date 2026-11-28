# product-skills

제품을 만드는 데 쓰는 역할별 Claude Code 플러그인 묶음(마켓플레이스) 리포다. 설치 방법과 플러그인 목록은 `README.md` 에 있다.

## 디렉터리

- `PRINCIPLE.md` - 이 리포에서 지켜야 할 규칙의 목록 [[one-rule-one-file]]
- `principles/` - 그 규칙의 내용. 규칙 하나가 문서 하나다
- `.claude-plugin/marketplace.json` - 이 리포가 내놓는 플러그인 목록
- `plugins/{플러그인}/` - 플러그인 하나. 다른 리포에서 설치할 때 이 폴더만 캐시로 복사된다
- `plugins/{플러그인}/principles/` - 그 플러그인의 스킬이 지키는 원칙. 원칙 하나가 파일 하나다 [[skill-principles-in-plugin]]
- `plugins/{플러그인}/PRINCIPLE.md` - 그 플러그인에 어떤 원칙이 있는지 적은 목록
- `plugins/shared/` - 여러 플러그인이 함께 쓰는 파일의 원본. 플러그인이 아니다. 처음 필요해질 때 만든다 [[shared-file-by-symlink]]
- `.claude/settings.json` - 이 리포 안에서 지금 브랜치의 플러그인을 쓰게 하는 설정 [[use-branch-plugins]]

## 원칙 문서

- **MUST** `[[이름]]` 은 `principles/{이름}.md` 로 읽는다. 플러그인 안 문서의 `[[이름]]` 은 그 플러그인의 `principles/{이름}.md` 다 [[wiki-link-only]]
- **MUST** 규칙을 적용하는 작업을 하기 전에 그 줄이 가리키는 원칙 문서를 읽는다
- **MUST** 리포 규칙의 내용은 `principles/` 에 규칙 하나당 문서 하나로 쓴다 [[one-rule-one-file]]
- **MUST** `PRINCIPLE.md` 에는 원칙마다 `[[이름]]` 과 한 문장 설명만 한 줄로 적는다 [[one-rule-one-file]]
- **MUST** 이 문서의 규칙은 `**MUST**` 같은 강도 표시로 시작하는 한 줄로 쓰고 끝에 `[[이름]]` 을 붙인다 [[one-rule-one-file]]
- **MUST** 원칙을 더하거나 빼거나 이름을 바꾸면 같은 커밋에서 `PRINCIPLE.md` 와 이 문서의 줄도 고친다 [[one-rule-one-file]]
- **MUST** 원칙의 내용을 고치기 전에 `grep -rn '\[\[{이름}\]\]' .` 로 그 원칙을 가리키는 문서를 찾아 함께 본다 [[one-rule-one-file]]
- **MUST** 원칙 문서를 가리킬 때는 항상 위키 링크(`[[이름]]`)를 쓴다 [[wiki-link-only]]
- **MUST NOT** `CLAUDE.md`, `PRINCIPLE.md`, `principles/`, `SKILL.md` 에서 원칙 문서를 가리킬 때 `[글자]` 뒤에 `(경로)` 를 붙이는 마크다운 링크 사용 [[wiki-link-only]]
- **MUST** 원칙 문서가 아닌 파일은 백틱으로 감싼 경로로 적는다 [[wiki-link-only]]
- **MUST** 원칙 파일 이름은 영어 소문자와 `-` 로 짓고, 맨 위와 모든 플러그인을 통틀어 겹치지 않게 한다 [[wiki-link-only]]

## 플러그인을 쓰고 고치기

- **MUST** 이 리포에서는 설치한 사본이 아니라 지금 브랜치의 `plugins/` 를 플러그인으로 쓴다 [[use-branch-plugins]]
- **MUST** 플러그인을 고친 뒤에는 새 세션을 열거나 `/reload-plugins` 를 실행해 반영한다 [[use-branch-plugins]]
- **MUST** 새 워크트리 폴더에서 처음 열 때 폴더 신뢰 질문에 답한다. 신뢰 전에는 리포 설정이 먹지 않는다 [[use-branch-plugins]]
- **SHOULD** 같은 스킬이 두 번 올라오면 `.claude/settings.local.json` 의 `enabledPlugins` 에 `false` 로 적어 끈다. 워크트리마다 따로 만든다 [[use-branch-plugins]]
- **MUST** 다른 리포에 반영하려면 고친 플러그인의 `plugin.json` `version` 을 올린다. 문장만 고쳤으면 셋째 자리, 스킬을 더하거나 빼거나 이름을 바꿨으면 둘째 자리다 [[bump-version-to-publish]]

## 플러그인을 나누고 더하기

- **MUST** 플러그인은 쓰는 사람의 역할(pm, design, dev)로 나눈다. 한 사람이 필요 없는 스킬까지 설치하게 되면 나눈다 [[split-plugin-by-role]]
- **MUST** 새 역할 스킬이 생기면 그 역할 플러그인을 새로 만든다 [[split-plugin-by-role]]
- **MUST NOT** 새 역할 스킬이 생겼다는 이유만으로 product 플러그인 쪼개기. 쪼갤지는 그때 따로 정한다 [[split-plugin-by-role]]
- **MUST** 플러그인을 더할 때는 `plugin.json`, `skills/`, `PRINCIPLE.md` 를 만들고 `marketplace.json`, 맨 위 `README.md` 표, `.claude/settings.json` 에 한 줄씩 더한다 [[add-plugin-checklist]]
- **MUST** 플러그인을 더한 뒤 `claude plugin validate .` 으로 확인한다 [[add-plugin-checklist]]

## 스킬이 지키는 원칙

- **MUST** 스킬이 지키는 원칙의 내용은 `plugins/{플러그인}/principles/` 에만 쓰고, 원칙 하나를 파일 하나로 둔다 [[skill-principles-in-plugin]]
- **MUST** 어떤 원칙이 있는지는 `plugins/{플러그인}/PRINCIPLE.md` 에 `[[이름]]` 과 한 문장 요약으로 한 줄씩 적는다 [[skill-principles-in-plugin]]
- **MUST NOT** `SKILL.md` 에 원칙의 내용 다시 쓰기. `[[이름]]` 으로 가리키기만 한다 [[skill-principles-in-plugin]]
- **MUST** 원칙을 `[[이름]]` 으로 가리키는 `SKILL.md` 에는 "`[[이름]]` 은 `${CLAUDE_PLUGIN_ROOT}/principles/{이름}.md` 를 가리킨다. 다른 폴더에서 같은 이름의 파일을 찾지 않는다." 를 넣는다 [[skill-principles-in-plugin]]
- **MUST** 원칙을 더하거나 빼거나 이름을 바꾸면 같은 커밋에서 그 플러그인의 `PRINCIPLE.md` 줄도 고친다 [[skill-principles-in-plugin]]

## 여러 플러그인이 함께 쓰는 파일

- **MUST NOT** 스킬이 `../shared/...` 처럼 플러그인 밖 파일 가리키기. 설치하면 플러그인 폴더만 복사되어 깨진다 [[shared-file-by-symlink]]
- **MUST** 원본은 `plugins/shared/` 에 하나만 두고(원칙 문서는 `plugins/shared/principles/`), 쓰는 플러그인 안에 원본을 가리키는 심볼릭 링크를 둔다 [[shared-file-by-symlink]]
- **MUST** 처음 쓸 때 다른 리포에서 실제로 설치해 캐시에 링크가 아닌 실제 파일로 들어왔는지 확인한다 [[shared-file-by-symlink]]
