---
name: blog-image-pencil
description: 블로그 글 작성 시 Pencil MCP로 본문 이미지 3장을 AI 생성하는 워크플로우. 블로그 글 작성 중 이미지가 필요할 때, "이미지 만들어", "이미지 추가", "썸네일 만들어", "Pencil로 이미지" 등의 요청이 있을 때 반드시 이 스킬을 사용할 것. 이미지 생성 → 확인 → PNG 내보내기 → HTML/마크다운 URL 업데이트까지 한 번에 처리.
---

# 블로그 이미지 생성 (Pencil MCP)

블로그 글 1편당 이미지 **3장** — 상단/중간/하단 위치에 배치.

## 사전 확인

Pencil.app이 실행 중이어야 한다. `get_editor_state` 호출 시 WebSocket 에러가 나면 사용자에게 알린다:
> "Pencil.app을 먼저 열어주세요: `! open /Applications/Pencil.app`"

## 워크플로우

### 1단계 — 캔버스 준비

```
get_editor_state(include_schema: false)
find_empty_space_on_canvas(width:700, height:1600, padding:100, direction:"right")
```

스키마가 이번 세션에서 아직 로드된 적 없으면 `include_schema: true`로 호출.

### 2단계 — 이미지 3장 생성

빈 공간 좌표 `{x, y}`를 기준으로 프레임 3개를 만들고 AI 이미지를 생성한다.

```javascript
// batch_design operations
f1=I("document",{type:"frame",width:700,height:467,x:X,y:Y,placeholder:true})
G(f1,"ai","[상단 이미지 프롬프트]")
f2=I("document",{type:"frame",width:700,height:467,x:X,y:Y+517,placeholder:true})
G(f2,"ai","[중간 이미지 프롬프트]")
f3=I("document",{type:"frame",width:700,height:467,x:X,y:Y+1034,placeholder:true})
G(f3,"ai","[하단 이미지 프롬프트]")
```

**이미지 프롬프트 작성 원칙:**
- 글의 각 섹션 내용을 반영해 구체적으로 작성
- 영어로 작성, photorealistic / cinematic / 8k 등 품질 키워드 포함
- 상단: 글 전체 주제를 대표하는 이미지
- 중간: 글의 핵심 개념이나 전환점 이미지
- 하단: 결론·시사점과 연결되는 이미지

### 3단계 — 결과 확인

```
get_screenshot(nodeId: "f1의 실제 ID")
get_screenshot(nodeId: "f2의 실제 ID")
get_screenshot(nodeId: "f3의 실제 ID")
```

이미지가 프롬프트 의도와 맞지 않으면 `G()`를 다시 호출해 재생성.

### 4단계 — placeholder 제거 및 내보내기

```javascript
// batch_design
U("f1_id",{placeholder:false})
U("f2_id",{placeholder:false})
U("f3_id",{placeholder:false})
```

내보내기 경로는 **현재 프로젝트 CLAUDE.md의 blog images 폴더** 참조.
경로가 명시되지 않은 경우 `blog-images/YYYY-MM-DD/` 폴더에 저장.

```
export_nodes(
  nodeIds: ["f1_id","f2_id","f3_id"],
  format: "png",
  outputDir: "[프로젝트 blog images 폴더]/YYYY-MM-DD/"
)
```

내보내기 후 파일명을 내용에 맞게 변경:
- `img1-{주제키워드}.png`
- `img2-{주제키워드}.png`
- `img3-{주제키워드}.png`

### 5단계 — 블로그 글에 이미지 삽입

프로젝트별 이미지 삽입 방식은 CLAUDE.md 참조.

**GitHub 기반 프로젝트** (GitHub raw URL 사용):
```
https://raw.githubusercontent.com/{repo}/main/{이미지경로}/{파일명}.png
```

**Tistory 직접 업로드 방식:**
이미지를 티스토리에 업로드 후 발급된 URL 사용.

이미지 width는 프로젝트별 CLAUDE.md에 정의된 값 사용 (기본: `width="600"`).

## 글 발행일 표시

글 상단에 날짜 추가 (마크다운 or HTML 방식):
```html
<p style="font-size:13px;color:#a0aec0;margin-bottom:4px;">YYYY년 M월 D일</p>
```

## 태그

글 작성 시 상단 주석 또는 메타 정보에 태그를 포함한다:

```
태그: 키워드1, 키워드2, 키워드3, ...
```

태그 기준 (10개):
- 핵심 키워드: 주제 고유명사, 교과목, 개념어
- 검색 유입 키워드: 독자가 검색할 법한 한국어
