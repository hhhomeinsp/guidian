"""SCORM 1.2 package export endpoint."""
import io
import zipfile
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from guidian.db.session import get_db
from guidian.models.models import Course, Module, User, UserRole
from guidian.routers.deps import require_roles

router = APIRouter(prefix="/courses", tags=["scorm"])


def _imsmanifest(course: Course) -> str:
    lessons = [l for m in course.modules for l in m.lessons]

    items_xml = ""
    resources_xml = ""
    for i, lesson in enumerate(lessons):
        sco_id = f"sco_{i + 1}"
        href = f"lesson_{i + 1}.html"
        items_xml += (
            f'          <item identifier="item_{i + 1}" identifierref="{sco_id}">\n'
            f"            <title>{lesson.title}</title>\n"
            f"          </item>\n"
        )
        resources_xml += (
            f'  <resource identifier="{sco_id}" type="webcontent" '
            f'adlcp:scormtype="sco" href="{href}">\n'
            f'    <file href="{href}"/>\n'
            f"    <file href=\"scorm_api.js\"/>\n"
            f"  </resource>\n"
        )

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="com.guidian.{course.slug}"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                      http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
    <adlcp:location>metadata.xml</adlcp:location>
  </metadata>
  <organizations default="org_1">
    <organization identifier="org_1">
      <title>{course.title}</title>
{items_xml}    </organization>
  </organizations>
  <resources>
{resources_xml}  </resources>
</manifest>"""


def _metadata_xml(course: Course) -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<lom xmlns="http://ltsc.ieee.org/xsd/LOM">
  <general>
    <identifier>
      <catalog>guidian</catalog>
      <entry>{course.id}</entry>
    </identifier>
    <title>
      <string language="en-US">{course.title}</string>
    </title>
    <description>
      <string language="en-US">{course.description or ""}</string>
    </description>
  </general>
  <educational>
    <typicalLearningTime>
      <duration>PT{int(course.ceu_hours * 60)}M</duration>
    </typicalLearningTime>
  </educational>
  <rights>
    <cost><value>no</value></cost>
    <copyrightAndOtherRestrictions><value>yes</value></copyrightAndOtherRestrictions>
    <description>
      <string language="en-US">Copyright Guidian. All rights reserved.</string>
    </description>
  </rights>
</lom>"""


def _scorm_api_js() -> str:
    return r"""/* Minimal SCORM 1.2 API stub for Guidian web player */
(function (window) {
  var _data = {
    "cmi.core.lesson_status": "not attempted",
    "cmi.core.score.raw": "",
    "cmi.core.session_time": "0000:00:00",
    "cmi.core.student_id": "",
    "cmi.core.student_name": "",
    "cmi.suspend_data": "",
  };
  var _initialized = false;
  var _sessionStart = null;

  function LMSInitialize(param) {
    _initialized = true;
    _sessionStart = new Date();
    _data["cmi.core.lesson_status"] = "incomplete";
    return "true";
  }

  function LMSFinish(param) {
    if (!_initialized) return "false";
    _initialized = false;
    return "true";
  }

  function LMSGetValue(element) {
    if (!_initialized) return "";
    return _data[element] !== undefined ? String(_data[element]) : "";
  }

  function LMSSetValue(element, value) {
    if (!_initialized) return "false";
    _data[element] = value;
    return "true";
  }

  function LMSCommit(param) {
    if (!_initialized) return "false";
    if (_sessionStart) {
      var elapsed = Math.floor((new Date() - _sessionStart) / 1000);
      var h = Math.floor(elapsed / 3600);
      var m = Math.floor((elapsed % 3600) / 60);
      var s = elapsed % 60;
      _data["cmi.core.session_time"] = (
        String(h).padStart(4, "0") + ":" +
        String(m).padStart(2, "0") + ":" +
        String(s).padStart(2, "0")
      );
    }
    return "true";
  }

  function LMSGetLastError() { return "0"; }
  function LMSGetErrorString(code) { return "No error"; }
  function LMSGetDiagnostic(code) { return ""; }

  window.API = {
    LMSInitialize: LMSInitialize,
    LMSFinish: LMSFinish,
    LMSGetValue: LMSGetValue,
    LMSSetValue: LMSSetValue,
    LMSCommit: LMSCommit,
    LMSGetLastError: LMSGetLastError,
    LMSGetErrorString: LMSGetErrorString,
    LMSGetDiagnostic: LMSGetDiagnostic,
  };

  /* Helper called by lesson page when quiz is passed */
  window.guidianScormPass = function (scorePercent) {
    LMSSetValue("cmi.core.lesson_status", "passed");
    LMSSetValue("cmi.core.score.raw", String(Math.round(scorePercent)));
    LMSCommit("");
  };
})(window);
"""


def _lesson_html(lesson_index: int, lesson_title: str, lesson_id: str, web_base: str) -> str:
    player_url = f"{web_base}/courses/{{course_id}}/lessons/{lesson_id}"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>{lesson_title}</title>
  <script src="../scorm_api.js"></script>
  <script>
    window.onload = function() {{
      if (window.API) window.API.LMSInitialize("");
      // Redirect to Guidian web player; SCORM API is available in parent frame
      window.location.href = "{player_url}?scorm=1";
    }};
  </script>
</head>
<body>
  <p>Loading {lesson_title}…</p>
</body>
</html>"""


def _index_html(course: Course, web_base: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>{course.title}</title>
  <script src="scorm_api.js"></script>
  <script>
    window.onload = function() {{
      if (window.API) window.API.LMSInitialize("");
      window.location.href = "{web_base}/courses/{course.id}?scorm=1";
    }};
  </script>
</head>
<body>
  <p>Redirecting to {course.title}…</p>
</body>
</html>"""


@router.get("/{course_id}/export/scorm")
async def export_scorm(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    _actor: User = Depends(require_roles(UserRole.admin, UserRole.org_admin)),
) -> StreamingResponse:
    """Generate a SCORM 1.2 ZIP package for any LMS (Moodle, Canvas, Blackboard)."""
    course = (
        await db.execute(
            select(Course)
            .options(selectinload(Course.modules).selectinload(Module.lessons))
            .where(Course.id == course_id)
        )
    ).scalar_one_or_none()

    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")

    web_base = "https://guidian-web.onrender.com"

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("imsmanifest.xml", _imsmanifest(course))
        zf.writestr("metadata.xml", _metadata_xml(course))
        zf.writestr("scorm_api.js", _scorm_api_js())
        zf.writestr("index.html", _index_html(course, web_base))

        lesson_index = 0
        for module in course.modules:
            for lesson in module.lessons:
                lesson_index += 1
                zf.writestr(
                    f"lesson_{lesson_index}.html",
                    _lesson_html(lesson_index, lesson.title, str(lesson.id), web_base),
                )

    buf.seek(0)
    filename = f"course-{course.slug}.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
