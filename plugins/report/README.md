# report

보고 자료를 만드는 스킬 묶음이다.

```
/plugin install report --marketplace dorage/product-skills
```

- `/report:presentation` — 자료와 주장을 받아 가로 16:9 발표 자료 PDF 로 만든다. 쪽별 하이라이트 뼈대를 먼저 승인받고, HTML 로 쓰고, PDF 로 뽑아 숫자로 검사한다

## 원칙 문서

스킬이 따르는 원칙은 `principles/` 에 원칙 하나가 문서 하나로 있다. 스킬은 자기에게 맞는 문서만 골라 `SKILL.md` 의 「적용하는 원칙」 표에 적고, 원칙의 내용은 다시 쓰지 않는다. 문서 모양과 목록은 [principles/README.md](principles/README.md) 에 있다.

## 필요한 도구

- Google Chrome: HTML 을 PDF 로 뽑는다 (macOS 경로 기준)
- `pdfinfo`, `pdftotext` (poppler): 검사 스크립트가 쪽 수, 쪽 크기, 넣지 않을 말을 센다
- `npx tsx` 또는 Node 24 이상: 검사 스크립트를 돌린다

## 고친 뒤 반영하기

- `.claude-plugin/plugin.json` 의 `version` 을 올린다
    - 문장만 고쳤으면 셋째 자리 (0.1.0 → 0.1.1)
    - 스킬을 더하거나 빼거나 이름을 바꿨으면 둘째 자리 (0.1.1 → 0.2.0)
- `/plugin update report@product-skills` 를 실행하고 새 세션을 연다
