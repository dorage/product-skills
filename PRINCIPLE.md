# 원칙 목록

이 리포에서 지켜야 할 규칙의 목록이다. 내용은 `principles/` 의 원칙 문서에 있고, 여기에는 목록만 둔다. `[[이름]]` 은 `principles/{이름}.md` 를 가리킨다.

## 원칙 문서를 쓰는 법

- [[one-rule-one-file]] - 리포 규칙은 규칙 하나를 문서 하나로 쓰고 `PRINCIPLE.md` 에 목록으로 적는다
- [[wiki-link-only]] - 원칙 문서를 가리킬 때는 항상 위키 링크(`[[이름]]`)를 쓴다

## 플러그인

- [[use-branch-plugins]] - 이 리포에서는 설치한 사본이 아니라 지금 브랜치의 플러그인을 그대로 쓴다
- [[split-plugin-by-role]] - 플러그인은 쓰는 사람의 역할로 나눈다
- [[add-plugin-checklist]] - 플러그인을 더할 때는 딸린 목록을 함께 고친다
- [[skill-principles-in-plugin]] - 스킬이 지키는 원칙은 플러그인의 `principles/` 에 모은다
- [[shared-file-by-symlink]] - 여러 플러그인이 함께 쓰는 파일은 원본 하나와 링크로 둔다
- [[bump-version-to-publish]] - 다른 리포에 반영하려면 플러그인 버전을 올린다
