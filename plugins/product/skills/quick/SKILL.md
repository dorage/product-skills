---
name: quick
description: 채팅으로 바로 시작하는 작업의 스펙을 크기와 상관없이 기능 폴더({yymmdd}_{feature_summary})의 requirements.md 로 써요. 다른 문서에서 넘어온 내용으로 요구사항 문서를 쓰는 건 product:draft 가 맡아요. 포맷은 product:draft 와 같아요 - 필요한 결정(A1, 옵션과 추천안), 요구사항(사용자 스토리 + EARS 인수 조건 + 업무 규칙 + 범위 밖), 마커, 그리고 설계(컴포넌트·시퀀스·오류·테스트 층. 설계가 크면 product:design 으로). 코드는 바꾸지 않아요. 마스터가 "A1. a" 처럼 답하면 같은 문서에 반영해요. 트리거 - `/product:quick {description}`, "간단히 스펙만", "채팅으로 바로 스펙"
---

# product:quick — 채팅으로 바로 시작하는 스펙

마스터가 채팅에 쓴 설명 하나로 바로 스펙을 시작한다. 정리된 다른 문서(회의록, 기획서, wiki)가 없어도 된다. 그런 문서에서 넘어온 내용으로 요구사항 문서를 세우는 일은 `product:draft` 가 맡는다. 결과는 새 기능 폴더의 `requirements.md` 한 파일이고, 요구사항과 설계 절을 함께 담는다. 코드는 바꾸지 않는다.

`[[이름]]` 은 `${CLAUDE_PLUGIN_ROOT}/principles/{이름}.md` 를 가리킨다. 다른 폴더에서 같은 이름의 파일을 찾지 않는다.

먼저 `${CLAUDE_PLUGIN_ROOT}/references/spec-format.md` 와 `${CLAUDE_PLUGIN_ROOT}/references/quick.md` 를 읽고, 뒤 문서가 가리키는 `references/draft.md` 「요구사항 템플릿」과 `references/design.md` 도 읽는다. 결정·마커·답 반영·저장 위치는 spec-format 을, 윤문은 [[polish-keeps-content]] 를, 문서의 모양은 `references/quick.md` 를 따른다. 이 스킬은 "언제 쓰고 어떤 순서로 쓰는가" 만 정한다.

## 크기

작업 크기로 quick 과 draft 를 나누지 않는다. 둘을 가르는 것은 시작점(채팅인가, 넘겨받은 문서인가)이다. 요구사항이 많아도 quick 으로 쓴다.

- 설계가 `references/quick.md` 「설계 절」의 설계 규모 기준을 넘으면, 「설계」 절 대신 `/product:design` 을 권하는 한 줄을 둔다
- 결정이 많아 한 그룹 문자 범위(`A`~`H`)를 넘으면 spec-format 「열린 결정」대로 기능을 나누자고 권한다

## 저장 경로 정하기

spec-format 「저장 위치」를 따른다. 파일 이름은 `requirements.md` 다.

- 경로를 받지 않았으면 `product:draft` 처럼 `{productDir}/features/` 아래에 새 기능 폴더를 만든다. 폴더 이름은 spec-format 「기능 폴더」의 `{yymmdd}_{feature_summary}` 다 (예: `.product/features/261128_receipt-staff-discount-line/requirements.md`)
- 마스터가 요청하기 전에는 이 파일을 커밋하지 않는다

## 쓰는 순서

- 「조사」를 한다
- Write 로 `requirements.md` 를 한 번에 쓴다. 문서가 짧아서 뼈대를 먼저 만들지 않는다
- [[polish-keeps-content]] 를 읽고 그대로 윤문한다

## 조사

- `git fetch` 후 `origin/main` 기준으로, 설명이 건드리는 코드만 읽는다
- 확인한 것은 `@사실 ({경로})`, 못 한 것은 "확인하지 않았다"

## 답 반영

마스터가 "A1. a" 처럼 답하면 spec-format 「답 반영」대로 같은 `requirements.md` 를 고친다. 새 문서를 만들지 않는다. 고친 뒤 같은 원칙 문서대로 다시 윤문한다.


## 끝맺음

- 첫 줄
    - 열린 결정이 있으면: 먼저 답할 결정 ID 하나와 추천안
    - 열린 결정이 없으면: "이 스펙대로 구현할까요?" 구현은 마스터가 요청할 때만 한다
- 둘째 줄: 문서 경로(클릭 가능한 `path`)
- 답을 반영했으면 "A1 반영: 요구사항 1 인수 조건 2" 처럼 바뀐 자리를 한 줄로 적는다
- 문서 내용을 채팅에 다시 늘어놓지 않는다

## 하지 않는 것

- 코드를 바꾸지 않는다
- 경로를 정하기 전에 파일을 쓰지 않는다
- `design.md` 를 따로 쓰지 않는다. 설계는 `requirements.md` 의 「설계」 절에 두고, 크면 `/product:design` 에 맡긴다
