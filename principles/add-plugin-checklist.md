# 플러그인을 더할 때는 목록 네 곳을 함께 고친다

플러그인 폴더만 만들면 마켓플레이스 목록, 안내 문서, 이 리포의 설정이 서로 어긋난다. 플러그인을 더하는 커밋에서 아래를 모두 한다. 플러그인을 새로 만들지 말지는 [[split-plugin-by-role]] 로 정한다.

- `plugins/{이름}/.claude-plugin/plugin.json` 과 `skills/` 를 만든다
- `plugins/{이름}/PRINCIPLE.md` 를 만든다. `principles/` 는 첫 원칙 파일을 쓸 때 함께 생긴다 ([[skill-principles-in-plugin]])
- `.claude-plugin/marketplace.json` 의 `plugins` 에 `"source": "./plugins/{이름}"` 으로 한 줄 더한다
- 맨 위 `README.md` 의 「플러그인」 표에 한 줄 더한다
- `.claude/settings.json` 의 `enabledPlugins` 에 `"{이름}@product-skills": true` 를 더한다. 이 리포에서 그 플러그인을 바로 쓰기 위해서다 ([[use-branch-plugins]])
- `claude plugin validate .` 으로 확인한다
