#!/usr/bin/env python3
"""문항 전수점검 스캐너 (2026-06 도입).

같은 실수(동사 누락 등) 재발 방지용. 신규/수정 문항 추가 후 실행:
    python3 tools/audit-questions.py

점검 기준:
  1. 동사 누락   — 정답이 don't/doesn't/do/does류인데 빈칸 뒤 본동사가 없음
                   (예: "I ___ in Incheon" + don't → "I don't in Incheon")
  2. 정답 보기없음 — MCQ에서 ans가 opts(보기)에 없음
  3. 복수정답     — opts에 정답과 동치(축약형 포함) 보기가 2개 이상
  4. 빈칸 없음    — fill/MCQ인데 문장에 빈칸(___)이 없음 ('고르세요'형 제외)

대상: game/questions.js (전 문항) + 워크시트 정적 MCQ(data-ans+choice).
JS 렌더 워크시트(gerund 계열)는 브라우저 점검 필요(이 스크립트 범위 밖).
"""
import json, re, glob, html, sys

ROOT = __file__.rsplit('/tools/', 1)[0]

CONTRACT = {"isn't": "is not", "aren't": "are not", "wasn't": "was not", "weren't": "were not",
            "don't": "do not", "doesn't": "does not", "didn't": "did not", "won't": "will not",
            "can't": "cannot", "shouldn't": "should not", "i'm": "i am", "it's": "it is",
            "let's": "let us"}

def norm(x):
    x = html.unescape(str(x)).lower().strip()
    for k, v in CONTRACT.items():
        x = x.replace(k, v)
    return re.sub(r'\s+', ' ', x).strip()

STOP = {'a', 'an', 'the', 'in', 'on', 'at', 'for', 'to', 'my', 'her', 'his', 'their', 'your',
        'our', 'not', 'soccer', 'meat', 'classes', 'coffee', 'tennis', 'lunch', 'math',
        'breakfast', 'dinner', 'water', 'a', 'sweet', 'drinks'}

def verb_missing(eng, ans):
    """정답이 do/does/did류 조동사인데 빈칸 뒤에 본동사가 없으면 True."""
    if '___' not in eng:
        return False
    if norm(ans) not in ('do not', 'does not', 'did not', 'do', 'does', 'did'):
        return False
    after = eng.split('___', 1)[1].strip()
    m = re.match(r"([a-zA-Z']+)", after)
    if not m:
        return True
    return m.group(1).lower() in STOP

def load_game():
    s = open(ROOT + '/game/questions.js', encoding='utf-8').read()
    start = s.index('{', s.index('GAME_QUESTIONS'))
    depth = 0; instr = False; esc = False; q = None; end = None
    for i in range(start, len(s)):
        c = s[i]
        if instr:
            if esc: esc = False
            elif c == '\\': esc = True
            elif c == q: instr = False
            continue
        if c in '"\'': instr = True; q = c; continue
        if c == '{': depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0: end = i + 1; break
    return json.loads(s[start:end])

def audit_game():
    data = load_game()
    issues = {'동사누락': [], '정답_보기없음': [], '복수정답': [], '빈칸없음': []}
    total = 0
    for unit, info in data.items():
        if not isinstance(info, dict) or 'questions' not in info:
            continue
        for qq in info['questions']:
            total += 1
            qid = qq.get('id', '?'); eng = qq.get('eng', ''); ans = str(qq.get('ans', '')); opts = qq.get('opts', [])
            is_ox = ans in ('O', 'X')
            is_scr = isinstance(qq.get('ans'), str) and len(ans.split()) >= 4
            is_choose = '고르세요' in eng or '고르시오' in eng  # 문장 선택형
            if not is_ox and not is_scr and verb_missing(eng, ans):
                issues['동사누락'].append((unit, qid, eng, ans))
            if opts and not is_scr:
                no = [norm(o) for o in opts]
                if norm(ans) not in no:
                    issues['정답_보기없음'].append((unit, qid, eng, ans, opts))
                if no.count(norm(ans)) >= 2:
                    issues['복수정답'].append((unit, qid, eng, ans, opts))
            if opts and not is_ox and not is_choose and '___' not in eng and '__' not in eng:
                issues['빈칸없음'].append((unit, qid, eng, ans))
    return total, issues

def audit_worksheets():
    files = [f for f in glob.glob(ROOT + '/*/index.html') + [ROOT + '/be-verb/v2.html', ROOT + '/gerund-basic/index2.html']
             if not re.search(r'/(game|game2|tower|whack-grammar|reading-jigsaw)/', f)]
    total = 0; noopt = []; dup = []
    for f in files:
        s = open(f, encoding='utf-8').read()
        for m in re.finditer(r"data-ans=(['\"])(.*?)\1(.*?)</div>", s, re.S):
            ans = m.group(2); body = m.group(3)
            opts = re.findall(r'class=["\']choice["\'][^>]*>(.*?)</button>', body, re.S)
            if not opts:
                continue
            total += 1
            no = [norm(re.sub('<[^>]+>', '', o)) for o in opts]
            short = f.replace(ROOT + '/', '')
            if norm(ans) not in no:
                noopt.append((short, ans, [re.sub('<[^>]+>', '', o).strip() for o in opts]))
            if no.count(norm(ans)) >= 2:
                dup.append((short, ans))
    return total, noopt, dup

def main():
    bad = 0
    gt, gi = audit_game()
    print(f"[게임] questions.js {gt}문항")
    for k, v in gi.items():
        print(f"  {k}: {len(v)}건")
        for r in v[:30]:
            print("    -", r[0], r[1], '|', r[2][:60], '| ans=', r[3])
        bad += len(v)
    wt, wno, wdup = audit_worksheets()
    print(f"[워크시트] 정적 MCQ {wt}개")
    print(f"  정답_보기없음: {len(wno)}건")
    for r in wno[:30]:
        print("    -", r)
    print(f"  복수정답: {len(wdup)}건")
    bad += len(wno) + len(wdup)
    print()
    print("✅ 이상 없음" if bad == 0 else f"⚠️  의심 {bad}건 — 검토 필요 (오탐 가능: 사전 미등록 동사 등)")
    sys.exit(1 if bad else 0)

if __name__ == '__main__':
    main()
