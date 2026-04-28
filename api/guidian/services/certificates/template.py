"""
Server-side HTML template for certificate PDFs.

This mirrors the look of the React `Certificate` component from the course
component library, but is rendered by headless Chromium (Playwright) on the
worker — NEVER the browser — per the non-negotiable: "Certificate PDFs must
be generated server-side and stored in S3. Never generate them client-side."
"""
from __future__ import annotations

import html as _html
from datetime import datetime

_AWARD_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
  stroke="#2563eb" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
  style="width:56px;height:56px;">
  <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>"""


def _fmt_date(dt: datetime) -> str:
    return dt.strftime("%B %-d, %Y") if hasattr(dt, "strftime") else str(dt)


def build_certificate_html(
    *,
    learner_name: str,
    course_title: str,
    ceu_hours: float,
    issued_at: datetime,
    verification_code: str,
    accrediting_body: str | None = None,
    instructor_name: str = "Guidian Editorial Team",
    instructor_credentials: str = "Home Inspection Professionals",
    course_approval_number: str | None = None,
    state_approvals: list | None = None,
    expiry_date: str | None = None,
    verify_url: str | None = None,
) -> str:
    ln = _html.escape(learner_name)
    ct = _html.escape(course_title)
    ab = _html.escape(accrediting_body) if accrediting_body else ""
    vc = _html.escape(verification_code)
    inst = _html.escape(instructor_name)
    creds = _html.escape(instructor_credentials)
    date_str = _fmt_date(issued_at)

    accrediting_line = (
        f' accredited by <span style="font-weight:600">{ab}</span>' if ab else ""
    )

    approval_block = ""
    if course_approval_number:
        ap = _html.escape(course_approval_number)
        approval_block = f'<p style="font-family:\'Helvetica Neue\',Arial,sans-serif;font-size:10pt;color:#64748b;margin:4px 0;">Course Approval #: <strong style="color:#0f172a">{ap}</strong></p>'

    states_block = ""
    if state_approvals:
        states_str = _html.escape(", ".join(str(s) for s in state_approvals if s))
        if states_str:
            states_block = f'<p style="font-family:\'Helvetica Neue\',Arial,sans-serif;font-size:10pt;color:#64748b;margin:4px 0;">State Approvals: <strong style="color:#0f172a">{states_str}</strong></p>'

    expiry_block = ""
    if expiry_date:
        ed = _html.escape(expiry_date)
        expiry_block = f'<p style="font-family:\'Helvetica Neue\',Arial,sans-serif;font-size:10pt;color:#64748b;margin:4px 0;">Valid Through: <strong style="color:#0f172a">{ed}</strong></p>'

    verify_block = ""
    if verify_url:
        vu = _html.escape(verify_url)
        verify_block = f'<p style="font-family:ui-monospace,Menlo,monospace;font-size:9pt;color:#64748b;margin-top:8px;">Verify at <a href="{vu}" style="color:#2563eb">{vu}</a></p>'

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Certificate of Completion — {ct}</title>
<style>
  @page {{ size: Letter landscape; margin: 0; }}
  html, body {{ margin: 0; padding: 0; }}
  body {{
    font-family: Georgia, "Times New Roman", serif;
    color: #0f172a;
    background: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }}
  .page {{
    width: 11in; height: 8.5in;
    padding: 0.75in;
    box-sizing: border-box;
    display: flex; flex-direction: column; align-items: center;
    justify-content: center;
    border: 14px double #2563eb;
    position: relative;
  }}
  .inner {{
    width: 100%;
    text-align: center;
    max-width: 8.5in;
  }}
  .eyebrow {{
    font-family: "Helvetica Neue", Arial, sans-serif;
    text-transform: uppercase;
    letter-spacing: 0.3em;
    font-size: 10pt;
    color: #64748b;
    margin: 12px 0 28px;
  }}
  .mono-label {{
    font-family: "Helvetica Neue", Arial, sans-serif;
    font-size: 11pt;
    color: #64748b;
  }}
  .learner {{
    font-size: 44pt;
    font-weight: 700;
    margin: 8px 0 4px;
    line-height: 1.1;
  }}
  .instructor {{
    font-family: "Helvetica Neue", Arial, sans-serif;
    font-size: 12pt;
    color: #475569;
    margin: 0 0 24px;
  }}
  .course {{
    font-size: 22pt;
    font-weight: 600;
    margin: 8px 0 12px;
    font-family: "Helvetica Neue", Arial, sans-serif;
  }}
  .ceu {{
    font-size: 14pt;
    margin: 0 0 16px;
  }}
  .meta-block {{
    margin: 0 0 24px;
  }}
  .footer {{
    display: flex;
    justify-content: space-between;
    width: 100%;
    font-family: "Helvetica Neue", Arial, sans-serif;
    font-size: 10pt;
    color: #64748b;
  }}
  .footer strong {{ color: #0f172a; display: block; }}
  .footer .code {{ font-family: ui-monospace, Menlo, monospace; font-size: 9pt; }}
  .seal {{ margin-bottom: 4px; }}
</style>
</head>
<body>
  <div class="page">
    <div class="inner">
      <div class="seal">{_AWARD_SVG}</div>
      <p class="eyebrow">Certificate of Completion</p>
      <p class="mono-label">This certifies that</p>
      <p class="learner">{ln}</p>
      <p class="instructor">{inst} &mdash; {creds}</p>
      <p class="mono-label">has successfully completed</p>
      <p class="course">{ct}</p>
      <p class="ceu">earning <strong style="font-weight:700">{ceu_hours} CEU hours</strong>{accrediting_line}.</p>
      <div class="meta-block">
        {approval_block}
        {states_block}
        {expiry_block}
      </div>
      <div class="footer">
        <div>
          <strong>{date_str}</strong>
          Date of completion
        </div>
        <div style="text-align:right">
          <strong class="code">{vc}</strong>
          Verification code
          {verify_block}
        </div>
      </div>
    </div>
  </div>
</body>
</html>"""
