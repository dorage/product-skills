---
name: quick
description: 채팅으로 바로 시작하는 작은 작업(요구사항 1~2개, 결정 3개 이하)의 스펙을 기능 폴더({yymmdd}_{feature_summary})의 requirements.md 로 써요. 다른 문서에서 넘어온 내용으로 요구사항 문서를 쓰는 건 product:draft 가 맡아요. 포맷은 product:draft 와 같아요 - 필요한 결정(A1, 옵션과 추천안), 요구사항(사용자 스토리 + EARS 인수 조건 + 업무 규칙 + 범위 밖), 마커, 그리고 작은 설계(컴포넌트·시퀀스·오류·테스트 층). 코드는 바꾸지 않아요. 규모가 크면 product:draft 로 넘겨요. 마스터가 "A1. a" 처럼 답하면 같은 문서에 반영해요. 트리거 - `/product:quick {description}`, "간단히 스펙만", "채팅으로 바로 스펙"
---

# product:quick — 채팅으로 바로 시작하는 스펙

마스터가 채팅에 쓴 설명 하나로 바로 스펙을 시작한다. 정리된 다른 문서(회의록, 기획서, wiki)가 없어도 된다. 그런 문서에서 넘어온 내용으로 요구사항 문서를 세우는 일은 `product:draft` 가 맡는다. 결과는 새 기능 폴더의 `requirements.md` 한 파일이고, 요구사항과 작은 설계를 함께 담는다. 코드는 바꾸지 않는다.

먼저 `${CLAUDE_PLUGIN_ROOT}/references/spec-format.md` 와 `${CLAUDE_PLUGIN_ROOT}/references/quick.md` 를 읽고, 뒤 문서가 가리키는 `references/draft.md` 「요구사항 템플릿」과 `references/design.md` 도 읽는다. 결정·마커·답 반영·저장 위치·윤문은 spec-format 을, 문서의 모양은 `references/quick.md` 를 따른다. 이 스킬은 "언제 쓰고 어떤 순서로 쓰는가" 만 정한다.

## 규모 확인

쓰기 전에 규모를 본다. 아래 중 하나라도 맞으면 쓰지 말고 `product:draft` 를 한 줄로 권한다. 요구사항과 설계를 한 문서에 담을 수 있는 크기를 넘었기 때문이다.

- 요구사항이 3개 이상이다
- 열린 결정이 4개 이상이다
- 새 도메인 용어를 정의해야 한다
- 마스터 말고 다른 사람(기획·운영·외부)이 읽고 정해야 한다

권하는 문장 예: "요구사항이 4개라 quick 한 장에 담기 어렵습니다. `/product:draft {설명}` 으로 요구사항 문서를 만들까요?"

## 저장 경로 정하기

spec-format 「저장 위치」를 따른다. 파일 이름은 `requirements.md` 다.

- 경로를 받지 않았으면 `product:draft` 처럼 `{productDir}/features/` 아래에 새 기능 폴더를 만든다. 폴더 이름은 spec-format 「기능 폴더」의 `{yymmdd}_{feature_summary}` 다 (예: `.product/features/261128_receipt-staff-discount-line/requirements.md`)
- 마스터가 요청하기 전에는 이 파일을 커밋하지 않는다

## 쓰는 순서

- 「조사」를 한다
- Write 로 `requirements.md` 를 한 번에 쓴다. 문서가 짧아서 뼈대를 먼저 만들지 않는다
- spec-format 「윤문」을 거친다

## 조사

- `git fetch` 후 `origin/main` 기준으로, 설명이 건드리는 코드만 읽는다
- 확인한 것은 `@사실 ({경로})`, 못 한 것은 "확인하지 않았다"

## 답 반영

마스터가 "A1. a" 처럼 답하면 spec-format 「답 반영」대로 같은 `requirements.md` 를 고친다. 새 문서를 만들지 않는다. 고친 뒤 spec-format 「윤문」을 다시 거친다.

- 반영하다 규모 확인 조건에 걸리면 `product:draft` 로 넘기기를 권한다. 넘길 때는 `/product:draft 저장 경로는 {이 requirements.md 경로} 다. 이 문서를 draft 모양으로 넓힌다` 처럼 같은 파일을 저장 경로로 준다. 「설계」 절은 뒤에 `/product:design` 이 design.md 로 옮긴다

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
- `design.md` 를 따로 쓰지 않는다. 작은 설계는 `requirements.md` 의 「설계」 절에 둔다
