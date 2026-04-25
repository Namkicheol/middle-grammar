---
name: middle-grammar-design
description: middle-grammar 디자인 시스템. 색상 테마(Baloo2 파란 그라디언트 vs 다크 네이비+앰버), 심화 워크시트 헤더 장식(.h-letter/.h-orb/도트그리드/웨이브), 섹션 헤더 폰트, 단어 뱃지(vocab), 문제 타입(mcq/input/scramble/dist). UI 작업 시 호출.
---

# 디자인 시스템

## 색상 테마

| 파일 | 테마 |
|------|------|
| `index.html`, `be-verb/v2.html`, `gerund-basic/index2.html`, `gerund-hard/index.html`, `to-will-basic/index.html` | Baloo 2 · 파란 그라디언트 (`#0ea5e9 → #6366f1`) |
| `general-verb-hard/index.html`, `past-be/index.html`, `past-be-hard/index.html`, `to-will-hard/index.html` | Baloo 2 · 다크 네이비 + 앰버 골드 (`#1e2a4a`, `#f59e0b`) |
| `gerund-basic/index.html` | Pretendard · 다크 네이비 + 앰버 골드 (`#0f172a`, `#fbbf24`) |

---

## 심화 워크시트 헤더 장식 (필수 · 2026-04-21~)

`past-be-hard`, `to-will-hard` 이후 제작되는 **모든 다크 네이비 테마 심화 워크시트**는 다음 헤더 장식 요소를 포함한다.

| 요소 | 내용 |
|------|------|
| `.h-letter` × 4 | 주제와 관련된 알파벳/기호 4개를 각 모서리에 떠다니게 배치 (투명도 `rgba(245,158,11,.14)`, `floatL` 9/11/7/13s 무한 애니메이션) |
| `.h-orb` × 2 | blur 50px 그라디언트 원 2개 (오렌지 + 인디고) |
| `.header::before` | 22px 간격 도트 그리드 |
| `.header::after` | 하단 웨이브(반원) 컷 |
| `.hbadge-dot` | 상단 배지 안의 펄스 애니메이션 점 |
| `padding` | `44px 20px 54px` (기본 `24px 20px 32px`보다 크게) |

예시: `to-will-hard`는 A/B/C/D, `past-be-hard`는 W/A/S/?. 알파벳 대신 "!" · "?" 등 의미 있는 기호도 가능.

---

## 섹션 헤더·지문 폰트 (심화 공통)

```css
.sec-hdr .lbl  { font-size:.78rem; }
.sec-hdr h2    { font-size:1.18rem; }
.sec-hdr .desc { font-size:.95rem; color:#5a6b8a; font-weight:500; line-height:1.55; }
.passage       { font-size:1.02rem; line-height:1.9; padding:18px 20px; }
.passage .ptitle{ font-size:.78rem; }
```

이전의 `.desc .8rem / gray` · `.passage .9rem`은 너무 작다는 피드백으로 상향 조정됨 (2026-04-21).

---

## 단어 뱃지 (vocab)

- `general-verb-hard`, `past-be-hard`: `.vocab` div — 기본 숨김, "📖 단어 보기 ▾" 버튼 클릭 시 토글
- `be-verb/v2.html`: JS 자동 주입 (`vocabData` 객체)
- `gerund-hard`: `vocabMap` 객체로 globalNum 기준 자동 주입
- 동명사 파일 sec0/sec1: `kor` 필드로 한국어 해석 표시
- 동명사 파일 sec2(구분하기): `kor` 필드로 한국어 해석 표시

---

## 문제 타입

| 타입 | 설명 |
|------|------|
| `mcq` | 객관식 4지선다 |
| `input` | 주관식 입력 |
| `scramble` | 단어 배열 |
| `dist` | 현재진행형 vs 동명사 구분 (2지선다) |
