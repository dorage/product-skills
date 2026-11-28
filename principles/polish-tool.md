# 윤문 도구는 이 문서 한 곳에서만 정한다

윤문에 쓰는 도구의 이름, 설치 명령, 부르는 법, 결과 파일의 모양은 이 문서에만 쓴다. 다른 문서는 "윤문 도구"라고만 부르고 이 문서를 가리킨다. 도구를 바꿀 때 이 문서 하나만 다시 쓰면 되게 하려는 것이다.

지금 도구는 `humanize-korean@im-not-ai` 플러그인이다.

## 부르는 쪽과의 약속

도구가 바뀌어도 아래는 그대로다. 부르는 쪽 원칙은 이것만 믿고 쓴다.

- 받는 것: 글 파일 경로 하나, 건드리지 않을 것 목록, 작업 파일을 둘 폴더
- 돌려주는 것: 윤문본 파일 경로 하나와 작업 파일이 든 폴더 경로. 윤문본에는 글만 있고 도구가 붙인 기록은 없다
- 도구 이름과 버전을 알려 준다. 부르는 쪽이 문서에 어떤 도구로 다듬었는지 적을 때 쓴다
- 준비가 안 됐으면 윤문하지 않고 `NOT_READY` 를 알린다. 부르는 쪽은 멈추지 않고 건너뛴다
- 입력 파일은 고치지 않는다. 덮어쓸지는 부르는 쪽이 정한다
- 작업 파일을 남길지 지울지는 부르는 쪽이 정한다

## 준비 확인

```bash
claude plugin list 2>/dev/null | grep -A1 'humanize-korean@im-not-ai' | sed -n 's/.*Version: *//p'
```

- 버전이 한 줄 나오면 `READY` 다. 그 값이 「도구 이름과 버전」의 `{버전}` 이다
- 아무것도 나오지 않으면 `NOT_READY` 다

## 도구 이름과 버전

- `{도구 이름}`: `humanize-korean@im-not-ai`
- `{버전}`: 「준비 확인」 명령이 내놓은 값. 예: `2.4.6`
- 부르는 쪽은 둘을 빈칸 하나로 이어 쓴다. 예: `humanize-korean@im-not-ai 2.4.6`

## 설치

아래 명령을 그대로 실행한다.

```bash
if claude plugin list 2>/dev/null | grep -q 'humanize-korean@im-not-ai'; then
  echo "TOOL_EXISTS"
else
  claude plugin marketplace list 2>/dev/null | grep -q 'im-not-ai' \
    || claude plugin marketplace add epoko77-ai/im-not-ai </dev/null >/dev/null 2>&1
  if claude plugin install humanize-korean@im-not-ai </dev/null >/dev/null 2>&1; then
    echo "TOOL_INSTALLED"
  else
    echo "TOOL_FAILED"
  fi
fi
```

- `TOOL_EXISTS`: 따로 말하지 않는다
- `TOOL_INSTALLED`: 두 줄을 답한다. 설치는 지금 세션에 바로 들어오지 않기 때문이다
    - `humanize-korean@im-not-ai 를 설치했습니다.`
    - `새 세션을 열어야 윤문이 동작합니다.`
- `TOOL_FAILED`: 마스터가 직접 칠 두 줄을 답한다. 윤문만 건너뛰고 나머지 일은 그대로 한다
    - `/plugin marketplace add epoko77-ai/im-not-ai`
    - `/plugin install humanize-korean@im-not-ai`

## 부르는 법

- `cd {작업 파일을 둘 폴더}` 로 옮겨 간다. 이 도구는 지금 폴더 아래에 작업 파일을 만든다
- `Skill(skill="humanize-korean:humanize-korean")` 를 부르고, args 에 아래를 넘긴다
    - 글 파일 경로
    - 강도 "가볍게". 고칠 곳이 적은 글의 과윤문을 막는 가벼운 경로다
    - 장르 `report`
    - 부르는 쪽이 준 건드리지 않을 것 목록
- 이 도구가 `Agent` 로 부르는 에이전트(`humanize-korean:humanize-monolith`·`humanize-diagnostician`·`humanize-finalizer`)는 모두 `model: "sonnet"`, `effort: "low"` 를 넘겨 부른다. 에이전트 정의의 모델 대신 이 값을 쓴다. 문장만 다듬는 가벼운 일이라 sonnet low 로 충분하고, haiku 는 이 계정에서 꺼 두었다
- 다 끝나면 `cd {세션 폴더}` 로 돌아온다

## 윤문본 꺼내기

- 작업 파일 폴더는 `{작업 파일을 둘 폴더}/_workspace/{run_id}/` 다. `cd` 가 이어지지 않았으면 세션 폴더(Claude Code 를 연 폴더) 아래 `_workspace/{run_id}/` 에 생긴다. 두 곳을 차례로 본다
- 윤문본은 그 폴더의 `final.md` 다. 끝에 붙은 요약 블록과 빈 줄을 지운다. 이 명령으로 `final.md` 자체를 고친다
    - `perl -0pi -e 's/\n*<!-- HUMANIZE-SUMMARY.*?-->\s*/\n/s' {작업 파일 폴더}/final.md`
- 두 곳 다 작업 파일 폴더가 없으면 윤문본이 없는 것이다. 부르는 쪽에 "윤문 작업 파일을 찾지 못했습니다"를 알린다

## 작업 파일 치우기

부르는 쪽이 남기라고 하면 옮기고, 지우라고 하면 지운다.

- 남길 때: `mv {작업 파일 폴더} {부르는 쪽이 정한 폴더}/{run_id}` 로 옮긴다
- 지울 때: `rm -r {작업 파일 폴더}` 로 지운다
- 옮기거나 지운 뒤 `_workspace/` 가 비었으면 `rmdir` 로 지운다. 다른 run 이 남아 있으면 그대로 둔다

## 도구를 바꿀 때

- 「준비 확인」부터 「작업 파일 치우기」까지 여섯 절과 맨 위 "지금 도구" 한 줄을 새 도구에 맞게 다시 쓴다
- 「부르는 쪽과의 약속」과 결과 값(`READY`·`NOT_READY`·`TOOL_EXISTS`·`TOOL_INSTALLED`·`TOOL_FAILED`)은 그대로 둔다. 다른 문서가 이 값에 기대고 있다
- 원본은 리포 맨 위 `principles/polish-tool.md` 하나다. 플러그인 안의 같은 이름 파일은 원본을 가리키는 링크라 따로 고치지 않는다
