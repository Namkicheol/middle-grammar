#!/usr/bin/env python3
"""
NE 능률 중2 교과서 자료 변환기
- HWP 파일: hwp5html로 HTML 변환 후 텍스트 추출 → Markdown
- PDF 파일: PyMuPDF로 텍스트 추출 → Markdown
출력 위치: ../Ne교과서 md파일/
"""

import subprocess
import sys
import shutil
import tempfile
import re
from html.parser import HTMLParser
from pathlib import Path

BASE_DIR = Path(__file__).parent
OUT_DIR = BASE_DIR.parent / "Ne교과서 md파일"
OUT_DIR.mkdir(exist_ok=True)


class _HwpTextExtractor(HTMLParser):
    """hwp5html 출력 XHTML에서 본문 텍스트를 순서대로 추출"""
    SKIP_TAGS = {"style", "script", "head"}

    def __init__(self):
        super().__init__()
        self.texts = []
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP_TAGS:
            self._skip += 1

    def handle_endtag(self, tag):
        if tag in self.SKIP_TAGS and self._skip:
            self._skip -= 1
        if tag in ("p", "br", "tr", "li"):
            self.texts.append("\n")

    def handle_data(self, data):
        if not self._skip:
            self.texts.append(data)

    def get_text(self) -> str:
        raw = "".join(self.texts)
        # 연속 빈줄 최대 2줄로 정리
        raw = re.sub(r"\n{3,}", "\n\n", raw)
        return raw.strip()


def hwp_to_md(hwp_path: Path) -> str:
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        result = subprocess.run(
            ["hwp5html", str(hwp_path), "--output", tmp],
            capture_output=True, text=True
        )
        xhtml_path = tmp_path / "index.xhtml"
        if not xhtml_path.exists():
            raise FileNotFoundError(f"HTML 변환 실패: {hwp_path.name}")

        html_content = xhtml_path.read_text(encoding="utf-8")
        extractor = _HwpTextExtractor()
        extractor.feed(html_content)
        text = extractor.get_text()

    title = hwp_path.stem.replace("_", " ")
    return f"# {title}\n\n{text}\n"


def pdf_to_md(pdf_path: Path) -> str:
    import fitz  # PyMuPDF

    doc = fitz.open(str(pdf_path))
    parts = []
    for i, page in enumerate(doc, 1):
        text = page.get_text("text").strip()
        if text:
            parts.append(f"## {i}페이지\n\n{text}")

    doc.close()

    title = pdf_path.stem
    body = "\n\n---\n\n".join(parts)
    return f"# {title}\n\n{body}\n"


def convert_hwp_files():
    hwp_files = sorted(BASE_DIR.rglob("*.hwp"))
    if not hwp_files:
        print("HWP 파일을 찾을 수 없습니다.")
        return

    for hwp in hwp_files:
        out_path = OUT_DIR / (hwp.stem + ".md")
        print(f"변환 중: {hwp.name} → {out_path.name}")
        try:
            md = hwp_to_md(hwp)
            out_path.write_text(md, encoding="utf-8")
            print(f"  ✓ 저장 완료 ({len(md):,} 자)")
        except Exception as e:
            print(f"  ✗ 오류: {e}", file=sys.stderr)


def convert_pdf_files():
    pdf_files = sorted(BASE_DIR.glob("*.pdf"))
    if not pdf_files:
        print("PDF 파일을 찾을 수 없습니다.")
        return

    for pdf in pdf_files:
        out_path = OUT_DIR / (pdf.stem + ".md")
        print(f"변환 중: {pdf.name} → {out_path.name}")
        try:
            md = pdf_to_md(pdf)
            out_path.write_text(md, encoding="utf-8")
            print(f"  ✓ 저장 완료 ({len(md):,} 자)")
        except Exception as e:
            print(f"  ✗ 오류: {e}", file=sys.stderr)


if __name__ == "__main__":
    print("=== HWP 변환 ===")
    convert_hwp_files()
    print("\n=== PDF 변환 ===")
    convert_pdf_files()
    print("\n완료! 출력 폴더:", OUT_DIR)
