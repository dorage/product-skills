# 여러 플러그인이 함께 쓰는 파일은 원본 하나와 링크로 둔다

설치하면 플러그인 폴더만 복사되므로, 스킬이 `../shared/...` 처럼 플러그인 밖 파일을 가리키면 설치한 뒤에 깨진다.

- 원본은 `plugins/shared/` 에 하나만 둔다. 스킬을 쓰는 쪽이 읽는 파일이라 `plugins/` 아래에 둔다. 맨 위 `principles/` 는 이 리포를 고칠 때 지키는 규칙만 담는다 ([[one-rule-one-file]])
- 함께 쓰는 원칙 문서의 원본은 `plugins/shared/principles/` 에 둔다
- `plugins/shared/` 는 플러그인이 아니다. `.claude-plugin/marketplace.json` 에 올리지 않는다
- 쓰는 플러그인 안에 원본을 가리키는 심볼릭 링크를 둔다 (예: `plugins/product/principles/polish-tool.md -> ../../shared/principles/polish-tool.md`)
- 스킬은 플러그인 밖 경로가 아니라 플러그인 안의 링크를 가리킨다

## 처음 쓸 때 확인

- 다른 리포에서 GitHub 마켓플레이스로 실제로 설치해 본다
- 캐시(`~/.claude/plugins/cache/product-skills/{플러그인}/`)에 링크가 아닌 실제 파일로 들어왔는지 확인한다
- 이 리포 안에서는 플러그인을 그 자리에서 읽어서([[use-branch-plugins]]), 설치한 뒤에만 깨지는 경로(플러그인 밖 파일을 가리키는 경로)가 드러나지 않는다
