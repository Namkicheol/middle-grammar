# 워크시트 문제 제작 가이드 — 예문 출처 & 유형 규칙

## 1. Ne능률 중1 교과서 md 파일 목록

`Ne교과서 md파일/` 폴더에 Lesson 1–8의 파일이 아래 4종류씩 있다.

| 파일 종류 | 파일명 패턴 | 내용 |
|-----------|-------------|------|
| 교과서 | `2022me_중1_Ln_교과서.md` | 본문 대화·지문, 표현, 읽기 본문 |
| 문법연습문제_기본AB | `2022me_중1_Ln_문법연습문제_기본AB.md` | Point A·B 기본 연습 (선택·빈칸·부정문 등) |
| 문법연습문제_심화 | `2022me_중1_Ln_문법연습문제_심화.md` | 오류 수정, 두 문장 합치기, 영작, 배열 |
| 어법드릴문제 | `2022me_중1_Ln_어법드릴문제.md` | Point A·B 집중 형태 드릴 + 정답 |

---

## 2. Lesson별 문법 단원

| Lesson | Point A | Point B |
|--------|---------|---------|
| L1 | be동사 현재형·부정문 | 일반동사 현재형·부정문 |
| L2 | 현재진행형·의문문 | 동명사 (동사 목적어) |
| L3 | be동사·일반동사 과거형 | 시간 접속사 when |
| L4 | to부정사 (동사 목적어) | 조동사 will, should |
| L5 | 재귀대명사 | 목적을 나타내는 to부정사 |
| L6 | 감각동사 look + 형용사 | 이유 접속사 because |
| L7 | make + 목적어 + 형용사 | 명사절 접속사 that |
| L8 | 감탄문 (What / How) | something + 형용사 |

---

## 3. 예문 우선순위 (필수)

문제를 만들 때 아래 순서로 예문 소재를 선택한다.

```
1순위  문법연습문제_기본AB / 어법드릴문제 예문
       → 해당 단원 문법에 맞게 이미 정리된 문장 → 그대로 쓰거나 단어만 교체
2순위  문법연습문제_심화 예문
       → 번역·배열·오류수정 지문 → 문장 자체는 유지, 형식만 워크시트 타입에 맞게 변환
3순위  교과서 본문(대화·지문) 예문
       → 실제 교과서 문장을 변형(단어 교체·주어 변경 등)해서 사용
       → 대화 상황에 나온 생생한 문장이므로 최대한 살려서 활용
```

**활용 원칙**
- 예문을 그대로 쓰지 않고 반드시 일부 변형 (단어 교체, 주어 변경, 시제 변환 등)
- 교과서 인물 이름(Jaeho, Diego, Amara 등)은 그대로 활용 가능 → 친숙함 유지
- 교과서에서 가져온 예문임을 워크시트 코드에 주석으로 표기할 필요 없음

---

## 4. 기본유형 — 현행 구조 유지

현재 워크시트의 기본 섹션 구조를 그대로 유지한다.

### 구조 (sec0 / sec1 기준)
```
mcq    × 10문제  — 4지선다, 빈칸 or 밑줄 선택
input  ×  5문제  — 빈칸 직접 입력 (괄호 힌트 포함)
scramble × 5문제 — 단어 칩 배열
```

### 기본유형 예문 작성 요령
- **mcq**: 어법드릴 문제의 문장을 단어 교체해서 4지선다로 변환
  - 예) 어법드릴 "He speaks three languages." → 단어만 바꿔 mcq 옵션 구성
- **input**: 기본AB의 빈칸 완성 문제를 그대로 활용 가능
  - 예) "Yuri __ text messages to her friends every day. (send)"
- **scramble**: 심화의 "단어 배열" 문제를 그대로 사용 (단, 정답 순서와 다르게 섞기)

---

## 5. 심화유형 — 현행 구조 유지 + 문법학습지 변형 유형 추가

심화 섹션(sec2 등)의 기본 틀은 유지하면서, 해당 Lesson의 문법학습지 심화 유형을 참고해 **일부 문제(3–5개)를 아래 패턴으로 변형**해서 추가한다.

### 추가 가능한 심화 변형 유형

#### 유형 A — 오류 수정 (input)
> 문법연습문제 심화 "밑줄 친 부분을 올바른 형태로 고쳐 써 봅시다" 참고

```javascript
// input 문제 — 어법상 틀린 단어를 고쳐 입력
{ type:"input",
  kor:"이 소파는 편안하게 보인다. (오류 수정)",
  eng:"This sofa looks comfortably. → ___",
  ans:"comfortable",
  hint:"감각동사 look 뒤에는 부사가 아니라 형용사를 씁니다." }
```

#### 유형 B — 문장 변환 (input)
> 문법연습문제 심화 "주어진 지시대로 바꿔 써 봅시다" 참고

```javascript
// input 문제 — 긍정문 → 부정문, 현재형 → 과거형 등 형태 변환
{ type:"input",
  kor:"The train arrives on time. (will 부정문으로)",
  eng:"The train will ___ arrive on time.",
  ans:"not",
  hint:"will 부정문은 will not[won't]!" }
```

#### 유형 C — 두 문장 합치기 (scramble)
> 문법연습문제 심화 "두 문장을 접속사로 연결하시오" 참고

```javascript
// scramble 문제 — 두 문장을 접속사로 연결한 완성 문장을 배열
{ type:"scramble",
  kor:"Paul이 집에 왔을 때 / 여동생이 TV를 보고 있었다.",
  ans:"When Paul came home his sister was watching TV",
  words:["home","watching","Paul","when","was","came","sister","his","TV"],
  hint:"When으로 시작하는 절 + 쉼표 없이 주절 연결" }
```

#### 유형 D — 우리말 → 영작 (input / scramble)
> 문법연습문제 심화 "우리말과 일치하도록 완성해 봅시다" 참고

```javascript
// input — 우리말 보고 핵심 표현 입력
{ type:"input",
  kor:"나는 런던 아이를 보기 위해 런던으로 여행했다.",
  eng:"I traveled to London ___ ___ the London Eye.",
  ans:"to see",
  hint:"목적을 나타내는 to부정사: to + 동사원형" }
```

### 심화유형 비율 가이드

| 유형 | 비율 |
|------|------|
| 기존 심화 문제 (scramble 중심) | 60–70% |
| 문법학습지 변형 (오류수정·문장변환·두 문장 합치기·영작) | 30–40% |

- 변형 유형은 해당 Lesson의 Point A/B 문법 포인트에 맞게만 선택
- 어법드릴 정답에 있는 문장을 변형 소재로 우선 사용

---

## 6. Lesson별 교과서 활용 예문 샘플

각 Lesson의 교과서·드릴 문장을 문제로 변형할 때 참고하는 예시다.

### L1 — be동사·일반동사 현재형

| 교과서/드릴 원문 | 변형 예시 |
|----------------|-----------|
| He is my teacher. | She ___ my homeroom teacher. → `is` |
| I love soccer. | Jaeho ___ basketball very much. → `loves` |
| Do you like bibimbap? | ___ she like Korean food? → `Does` |
| My favorite food is pizza. | His favorite subject ___ science. → `is` |
| She doesn't eat meat. | He ___ like spicy food. → `doesn't` |

### L2 — 현재진행형·동명사

| 교과서/드릴 원문 | 변형 예시 |
|----------------|-----------|
| Lily is watering the plants now. | Jaden ___ soccer right now. → `is playing` |
| I kept waiting for one hour. | She kept ___ for the bus. → `waiting` |
| Eric enjoys skiing. | Minho enjoys ___ on weekends. → `hiking` |
| She gave up waking up early. | He gave up ___ the piano. → `playing` |

### L3 — 과거형·when

| 교과서/드릴 원문 | 변형 예시 |
|----------------|-----------|
| Ian went shopping and bought some clothes. | She ___ to the market and bought vegetables. → `went` |
| She was in England last year. | They ___ in Busan last summer. → `were` |
| When Paul came home, his sister was watching TV. | When I came home, my mom ___ dinner. → `was making` |

### L4 — to부정사(목적어)·will/should

| 교과서/드릴 원문 | 변형 예시 |
|----------------|-----------|
| Andy wants to have a car. | She wants ___ a new bag. → `to buy` |
| They promised to keep the secret. | He promised ___ on time. → `to arrive` |
| You should go to sleep early. | You ___ drink water often. → `should` |
| I will call you tomorrow. | She ___ visit us next week. → `will` |

### L5 — 재귀대명사·목적 to부정사

| 교과서/드릴 원문 | 변형 예시 |
|----------------|-----------|
| James took it himself. | She made the cake ___. → `herself` |
| Mandy went to a park to relax. | Sohee went to London ___ the London Eye. → `to see` |
| She called the restaurant to reserve a table. | He went to the store ___ some milk. → `to buy` |

### L6 — look+형용사·because

| 교과서/드릴 원문 | 변형 예시 |
|----------------|-----------|
| That dog looks hungry. | The students ___ tired after PE class. → `look` |
| Eric turned down the volume because the music was too loud. | She wore a coat ___ it was cold outside. → `because` |
| Roy caught a cold. He had a headache. | Because Roy caught a cold, he ___ a headache. → `had` |

### L7 — make+목적어+형용사·that절

| 교과서/드릴 원문 | 변형 예시 |
|----------------|-----------|
| Warm tea makes me relaxed. | Her smile ___ everyone happy. → `makes` |
| John thinks that health is most important. | I believe ___ she will get better soon. → `that` |
| Sally heard that her friend would move. | He said ___ he lost his phone. → `that` |

### L8 — 감탄문·something+형용사

| 교과서/드릴 원문 | 변형 예시 |
|----------------|-----------|
| How beautiful the sunset is! | ___ delicious the cake is! → `How` |
| What a talented singer she is! | ___ a fast runner he is! → `What` |
| We want something tasty for dinner. | I need ___ cool to drink. → `something` |
| Kelly brought something sweet for dessert. | He planned ___ special for her birthday. → `something` |

---

## 7. 문제 소재 선택 체크리스트

새 워크시트 문제를 만들기 전:

1. 해당 Lesson의 `어법드릴문제.md` 먼저 열기 → Point A/B 문장 목록 확인
2. `문법연습문제_기본AB.md` 확인 → Check-Up 문장 중 활용 가능한 것 선별
3. `문법연습문제_심화.md` 확인 → 오류수정·배열·영작 문장 심화 유형 소재로 활용
4. 위 세 파일로 부족하면 `교과서.md` 본문 대화·지문에서 문장 발굴 후 변형
5. 선택한 문장은 단어/인물명 한 군데 이상 변형해서 사용 (직접 복사 최소화)
