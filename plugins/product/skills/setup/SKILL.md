---
name: setup
description: 지금 폴더에 product 를 붙여요. 리포지토리 외부 셋업(지금 폴더를 product 루트로 삼고 리포를 repos/ 아래 submodule 로 더함)과 리포지토리 내부 셋업(리포 안에 .product/ 를 만들어 커밋 1개) 중 하나를 고르게 하고, 문서를 쓰는 스킬이 찾을 product 폴더(.product/)와 설정 파일(.product-settings)을 만들어요. 셋업은 npm 의 product CLI(`@dorage/product`)가 맡고, 기대 버전이 없으면 설치하고, npm 이 없으면 같은 셋업을 하는 setup.sh 를 써요. 산출물 윤문(references/spec-format.md 「윤문」)에 쓰는 `humanize-korean@im-not-ai` 플러그인이 없으면 마켓(epoko77-ai/im-not-ai)을 더하고 설치해요. 이미 셋업한 폴더면 셋업 방식과 경로만 알려요. 트리거 - `/product:setup`, "product 준비해줘", "product 셋업해줘"
---

# product:setup — product 폴더 셋업과 윤문 플러그인 준비

지금 폴더에 product 폴더(`.product/`)와 설정 파일(`.product-settings`)을 만든다. 문서를 쓰는 스킬은 이 폴더를 `references/spec-format.md` 「저장 위치」대로 찾는다.

셋업은 늘 `.product/` 를 만든다. 다른 이름을 쓰려면 셋업 뒤에 폴더 이름을 바꾸고 설정 파일에 `productDirName: {새 이름}` 한 줄을 더한다. `productDirName` 은 설정 파일이 있는 폴더 바로 아래 폴더 이름 하나다. `/` 나 `\` 가 든 경로, `.`, `..` 은 깨진 설정 파일로 본다. 설정 파일이 있으면 그 폴더를 product 루트로 보므로, 이미 셋업했다는 판단과 경로도 `productDirName` 을 따른다.

절은 아래 순서로 탄다. 「CLI 준비」가 멈춰도 「윤문 플러그인」 결과는 답한다.

- 「윤문 플러그인」: 늘 실행한다
- 「CLI 준비」: `product` 명령을 기대 버전으로 맞춘다
- 「질문」: 지금 폴더를 살펴보고 필요한 것만 묻는다
- 「셋업 실행」: 답을 옵션으로 넘겨 한 번에 셋업한다
- 「답하기」: 결과를 알린다

## 윤문 플러그인

아래 명령을 그대로 실행한다.

```bash
if claude plugin list 2>/dev/null | grep -q 'humanize-korean@im-not-ai'; then
  echo "PLUGIN_EXISTS"
else
  claude plugin marketplace list 2>/dev/null | grep -q 'im-not-ai' \
    || claude plugin marketplace add epoko77-ai/im-not-ai </dev/null >/dev/null 2>&1
  if claude plugin install humanize-korean@im-not-ai </dev/null >/dev/null 2>&1; then
    echo "PLUGIN_INSTALLED"
  else
    echo "PLUGIN_FAILED"
  fi
fi
```

## CLI 준비

플러그인이 기대하는 CLI 버전은 `${CLAUDE_PLUGIN_ROOT}/cli-version` 한 줄에 있다. 아래 명령을 그대로 실행한다.

이 문서의 `${CLAUDE_PLUGIN_ROOT}` 가 경로로 바뀌지 않고 글자 그대로 보이면, 이 스킬 폴더(`SKILL.md` 가 든 폴더)의 두 단계 위 폴더 경로로 바꿔 넣는다. 아래 `setup.sh` 경로도 같다.

```bash
want=$(cat "${CLAUDE_PLUGIN_ROOT}/cli-version" 2>/dev/null)
get_cli() {
  if err=$(npm i -g "@dorage/product@$want" 2>&1 >/dev/null); then return 0; fi
  echo "CLI_FAILED $want"
  printf '%s\n' "$err" | sed '/^[[:space:]]*$/d' | tail -n 1
  return 1
}
if [ -z "$want" ]; then
  echo "NO_VERSION"
elif ! command -v npm >/dev/null 2>&1 && ! product --version --expect "$want" >/dev/null 2>&1; then
  echo "NO_NPM"
elif ! command -v product >/dev/null 2>&1; then
  get_cli && echo "CLI_INSTALLED $want"
elif product --version --expect "$want" >/dev/null 2>&1; then
  echo "CLI_OK $(product --version)"
else
  have=$(product --version 2>/dev/null || echo "?")
  get_cli && echo "CLI_UPDATED $have $want"
fi
```

- `CLI_OK`·`CLI_INSTALLED`·`CLI_UPDATED`: 「질문」으로 간다. 셋업은 `product` 로 한다
- `NO_NPM`: 「질문」으로 간다. 셋업은 `setup.sh` 로 한다 (「셋업 실행」)
- `CLI_FAILED`: 셋업하지 않고 「답하기」로 간다
- `NO_VERSION`: `cli-version` 파일을 읽지 못했다. 버전 없이 설치하지 않는다. 셋업하지 않고 「답하기」로 간다

`product --version --expect {버전}` 은 지금 CLI 가 그 버전보다 낮으면 종료 코드 5 로 끝난다. 버전 글자를 셸에서 직접 비교하지 않는다. 0.10.0 이 0.9.0 보다 작게 나오기 때문이다.

## 질문

### 지금 폴더 살펴보기

- `product` 로 셋업할 때: `product inspect --json`
    - 결과: `here`(`productDir`·`settings`·`mode`·`reason`, 지금 폴더에 `.product/` 가 없으면 `null`), `ancestor`(위쪽 product 폴더 경로 또는 `null`), `git`(`inside`·`top`·`isTop`·`hasCommits`)
- `setup.sh` 로 셋업할 때: `sh "${CLAUDE_PLUGIN_ROOT}/skills/setup/setup.sh" inspect`
    - 결과는 JSON 이 아니라 `키: 값` 줄이다. 값 `none` 은 `null` 이다. 키는 아래처럼 맞춘다
        - `here: {경로}` → `here.productDir`. `here: none` 이면 `here` 가 `null` 이다
        - `settings:` → `here.settings`. `none` 은 `.product/` 가 없다는 뜻이다
        - `mode:` → `here.mode`
        - `ancestor:` → `ancestor`
        - `git.inside:`·`git.top:`·`git.isTop:`·`git.hasCommits:` → 같은 이름 (`true`·`false` 글자)

### 묻는 순서

아래를 위에서부터 보고, 해당하는 것만 `AskUserQuestion` 으로 묻는다. 한 번에 물을 수 있는 것은 한 번에 묻는다. 결과로 이미 답이 정해진 것은 묻지 않는다.

- `here.settings` 가 `ok`: 묻지 않는다. 셋업하지 않고 「답하기」로 간다 (이미 셋업함)
- `here.settings` 가 `invalid`: 묻지 않는다. 셋업하지 않고 「답하기」로 간다
- `here.settings` 가 `missing`: 셋업 방식만 묻는다. `.product/` 는 두고 설정 파일만 만든다
- `here` 가 `null` 이고 `ancestor` 가 경로: 그 경로를 보여 주고 "그래도 여기에 셋업할까요" 를 묻는다. 아니오면 셋업하지 않고 끝낸다. 예면 `--allow-nested` 를 붙인다
- 셋업 방식: 리포지토리 외부 셋업과 리포지토리 내부 셋업 중 하나를 고르게 한다. 옵션마다 아래 「셋업 방식 옵션」의 문장을 그대로 보여 준다
- 외부 셋업을 골랐을 때
    - `git.inside` 가 true 이고 `git.isTop` 이 false: 더 묻지 않는다. 다른 리포의 하위 폴더라 외부 셋업을 할 수 없다. 리포 밖 폴더에서 다시 부르라고 답하고 끝낸다
    - `git.hasCommits` 가 true: "이 리포(`git.top`)를 product 루트로 써도 될까요" 를 묻는다. 개발 리포라면 submodule 이 관리자에게 보인다는 것을 함께 적는다. 아니오면 셋업하지 않고 끝낸다. 예면 `--use-existing-repo` 를 붙인다
    - 리포 주소: 고를 것이 아니라서 `AskUserQuestion` 대신 채팅으로 "repos/ 아래에 더할 리포 주소를 한 줄에 하나씩 보내 주세요" 라고 묻는다. 하나 이상 받는다
- 내부 셋업을 골랐을 때
    - `git.inside` 가 false: 더 묻지 않는다. 리포 밖이라 내부 셋업을 할 수 없다. 외부 셋업을 권하고 끝낸다
    - `git.isTop` 이 false: 리포 맨 위(`git.top`)와 지금 폴더 중 어디에 `.product/` 를 만들지 묻는다. 답은 `top` 또는 `here` 다

### 셋업 방식 옵션

옵션 설명에 「정해진 원칙」의 마스터 문장을 따옴표째 옮긴다. 줄이거나 바꿔 쓰지 않는다.

- 리포지토리 외부 셋업
    - 하는 일: 지금 폴더를 product 루트로 삼고, 리포 주소들을 받아 `repos/` 아래 submodule 로 더한다
    - 언제: "혼자 product를 사용하거나, 여러 리포지토리에 걸쳐서 사용하기 위한 방법이다." "이 방식을 이용하면, 실제 개발 리포지토리를 보는 관리자들은 product의 사용여부를 알 수 없다."
    - 단점: "다만, product의 도메인 정보가 빠르게 낡을 수 있다는 단점이 있다."
- 리포지토리 내부 셋업
    - 하는 일: 이 리포 안에 `.product/` 를 만들고, 지금 브랜치에 두 파일만 담은 커밋 1개를 만든다
    - 언제: "모든 관리자가 product를 사용하기로 합의하고, 리포지토리에 .product를 업로드하는 것을 허용한 경우에 사용하는 방식이다."
    - 단점: "다만, product 수정사항이 리포지토리 커밋 히스토리에 섞인다는 단점이 있다."

## 셋업 실행

받은 답을 옵션으로 붙여 명령 하나를 실행한다. 명령이 직접 묻지 않게 질문은 스킬이 먼저 끝낸다.

| 셋업 | `product` 로 | `setup.sh` 로 |
| --- | --- | --- |
| 외부 | `product setup --mode external --repo {주소1} --repo {주소2} --json` | `sh "${CLAUDE_PLUGIN_ROOT}/skills/setup/setup.sh" external {주소1} {주소2}` |
| 내부 | `product setup --mode internal --json`. 맨 위가 아니면 `--at top` 또는 `--at here` | `sh "${CLAUDE_PLUGIN_ROOT}/skills/setup/setup.sh" internal top`. 맨 위가 아니고 지금 폴더를 골랐으면 `here` |
| 설정 파일만 | `product setup --settings-only --mode {external\|internal} --json` | `sh "${CLAUDE_PLUGIN_ROOT}/skills/setup/setup.sh" settings-only {external\|internal}` |

- 「질문」에서 붙이기로 한 `--allow-nested`·`--use-existing-repo` 는 `product` 명령에만 붙인다. `setup.sh` 는 이 두 옵션이 없고 묻지도 않으므로, 「질문」에서 아니오를 받았으면 부르지 않는다
- 주소는 따옴표로 감싸 넘긴다
- `product` 는 실패해도 표준 출력에 JSON 한 줄(`status`·`reason`·`next`)을 남긴다. 종료 코드가 0 이 아니어도 그 JSON 을 읽는다
- `product` 가 `status` `need` 로 끝나면(종료 코드 2), `need` 의 항목마다 「질문」의 같은 질문을 하고 옵션을 붙여 다시 부른다. 항목과 옵션은 `mode` → `--mode`, `repo` → `--repo {주소}` (주소마다), `use-existing-repo` → `--use-existing-repo`, `allow-nested` → `--allow-nested`, `at` → `--at top|here` 다. 아니오를 받으면 다시 부르지 않고 끝낸다
- `setup.sh` 의 결과는 첫 줄이 상태(`DONE`·`ALREADY`·`STOPPED`·`COMMIT_FAILED`)이고, 그 아래가 `키: 값` 줄이다. `next:` 줄이 여러 개일 수 있다
- 결과의 `next` 는 실행하지 않고 보여 주기만 한다. 커밋과 push 는 사용자가 한다. 명령이 아닌 문장(`앞으로 개발은 repos/{이름}/ 에서 한다`)도 섞여 있다

## 답하기

「윤문 플러그인」 결과를 맨 끝에 붙인다. 아래 「윤문 플러그인 결과」를 따른다.

### 셋업 결과

`product` 의 `status` 와 `setup.sh` 의 첫 줄로 고른다.

- 이미 셋업함 (「질문」에서 `here.settings` 가 `ok`, 또는 `already`·`ALREADY`): 한 줄로 답한다. 예: `이미 셋업했습니다: 리포지토리 내부 셋업, ~/work/shop/.product/`. 셋업 방식은 설정 파일의 `mode` 다 (`external` 은 리포지토리 외부 셋업, `internal` 은 리포지토리 내부 셋업). 이때 「CLI 준비」가 `CLI_OK` 이고 윤문 플러그인이 `PLUGIN_EXISTS` 면 이 한 줄만 답한다
- `done`·`DONE`
    - 첫 줄: 셋업 방식과 product 폴더 경로. 예: `리포지토리 외부 셋업을 마쳤습니다: ~/work/cafe/.product/`
    - 외부 셋업: 더한 리포(`added`)를 한 줄로. 건너뛴 리포(`skipped`)가 있으면 리포마다 주소와 이유를 한 줄씩
    - 내부 셋업: 만든 커밋(`commit`) 앞 7자리
    - 설정 파일만 만들었을 때: 커밋은 하지 않았다는 한 줄
    - 그 아래 `next` 를 그대로. 명령은 코드 블록에, 문장은 문장으로 둔다
- `stopped`·`STOPPED`: `reason` 한 줄과 `next` 가 있으면 그것
- `commitFailed`·`COMMIT_FAILED`: `reason` 한 줄, `.product/` 와 설정 파일은 남아 있다는 한 줄, `next` 의 커밋 명령. 리포 규칙(훅, 서명)을 건너뛰는 옵션은 권하지 않는다
- `settings` 또는 「질문」에서 `here.settings` 가 `invalid`: 어느 파일이 왜 문제인지(`reason`)와 "설정 파일을 고치거나 지운 뒤 `/product:setup` 을 다시 부르세요" 한 줄
- `error`: `reason` 한 줄과 `next`
- 「질문」에서 셋업하지 않고 끝냈을 때: 무엇 때문에 멈췄는지 한 줄

### CLI 결과

- `CLI_INSTALLED`·`CLI_OK`: 따로 말하지 않는다
- `CLI_UPDATED {이전} {기대}`: 바꾼 버전 한 줄. 예: `product CLI 0.1.0 → 0.2.0`
- `NO_VERSION`: 셋업은 하지 않았다는 것과 "플러그인의 `cli-version` 파일을 읽지 못했습니다. `/plugin update product@product-skills` 뒤 새 세션에서 다시 부르세요" 한 줄
- `CLI_FAILED`: 셋업은 하지 않았다는 것, 그 아래 줄의 실패 이유 한 줄, 직접 칠 설치 명령 `npm i -g @dorage/product@{기대 버전}`. 설치한 뒤 `/product:setup` 을 다시 부르라고 적는다
- `NO_NPM`: 셋업 결과 아래에 "product CLI 가 없어서 문서를 쓰는 스킬은 node 를 설치한 뒤 `/product:setup` 을 다시 부르면 쓸 수 있습니다" 한 줄

### 윤문 플러그인 결과

- `PLUGIN_EXISTS`: 따로 말하지 않는다
- `PLUGIN_INSTALLED`: 두 줄을 답한다. 설치는 지금 세션에 바로 들어오지 않기 때문이다
    - `humanize-korean@im-not-ai 를 설치했습니다.`
    - `새 세션을 열어야 윤문이 동작합니다.`
- `PLUGIN_FAILED`: 마스터가 직접 칠 두 줄을 답한다. 셋업은 그대로 쓸 수 있고, 윤문만 건너뛴다
    - `/plugin marketplace add epoko77-ai/im-not-ai`
    - `/plugin install humanize-korean@im-not-ai`
