# 원칙 문서를 가리킬 때는 항상 위키 링크를 쓴다

원칙 문서를 가리키는 링크는 `[[이름]]` 한 가지 모양으로만 쓴다. 모양이 하나면 `[[` 만 검색해서 어떤 원칙이 어떤 원칙을 가리키는지 관계 그래프를 만들 수 있고, 원칙 하나를 고칠 때 그 원칙을 가리키는 곳을 빠짐없이 찾을 수 있다.

## 쓰는 법

- `[[이름]]` 의 이름은 원칙 파일 이름에서 `.md` 를 뺀 것이다. `[[wiki-link-only]]` 는 `principles/wiki-link-only.md` 를 가리킨다
- 맨 위 문서의 `[[이름]]` 은 맨 위 `principles/` 를, 플러그인 안 문서의 `[[이름]]` 은 그 플러그인의 `principles/` 를 가리킨다
- 경로는 쓰지 않고 이름만 쓴다. 그래서 원칙 파일 이름은 맨 위와 모든 플러그인을 통틀어 하나뿐이어야 한다. 링크로 함께 쓰는 같은 문서([[shared-file-by-symlink]])는 같은 이름을 쓴다
- `[글자]` 뒤에 `(경로)` 를 붙이는 마크다운 링크와 「절 이름」 같은 글자만으로 가리키는 방식은 쓰지 않는다
- 아직 없는 원칙을 `[[이름]]` 으로 가리키지 않는다. 가리키려면 같은 커밋에서 그 원칙 문서를 만든다

## 적용하는 곳

- `CLAUDE.md`, 맨 위 `PRINCIPLE.md`, 맨 위 `principles/` 안의 모든 문서
- 플러그인의 `PRINCIPLE.md`, `principles/` 안의 모든 문서, `SKILL.md`. 설치한 사람의 세션에서도 읽히게 하는 방법은 [[skill-principles-in-plugin]] 에 있다
- `README.md` 는 대상이 아니다. GitHub 화면에서 눌러 들어가는 문서라 마크다운 링크를 쓴다
- 원칙 문서가 아닌 파일(`README.md`, `.claude/settings.json` 등)은 링크로 걸지 않고 백틱으로 감싼 경로로 적는다. 같은 이름의 파일이 여러 폴더에 있어서 이름만으로는 하나로 정해지지 않기 때문이다
- 리포 밖 주소는 주소를 그대로 적는다

## 확인

- `grep -n '][(]' CLAUDE.md PRINCIPLE.md principles/*.md plugins/*/PRINCIPLE.md plugins/*/principles/*.md` 의 결과가 없어야 한다
- `[[이름]]` 마다 맨 위나 그 플러그인의 `principles/{이름}.md` 가 있어야 한다
- `ls principles plugins/*/principles | grep '\.md$' | sort | uniq -d` 의 결과가 링크로 함께 쓰는 문서뿐이어야 한다

이 규칙이 받치는 문서 구조는 [[one-rule-one-file]] 에 있다.
