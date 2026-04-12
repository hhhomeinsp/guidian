"""Server-side quiz scoring. Never trust client-computed scores."""
from __future__ import annotations

from typing import Any

from guidian.schemas.quiz import QuestionResult


def _answer_matches(question_type: str, correct: Any, answer: Any) -> bool:
    if answer is None:
        return False
    if question_type == "true_false":
        return bool(answer) == bool(correct)
    # single_choice: correct may be int or [int]
    if question_type == "single_choice":
        expected = correct[0] if isinstance(correct, list) else correct
        try:
            return int(answer) == int(expected)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return False
    # multiple_choice: correct is list[int], answer is list[int]
    if question_type == "multiple_choice":
        if not isinstance(answer, list):
            return False
        expected_list = correct if isinstance(correct, list) else [correct]
        return sorted(int(x) for x in answer) == sorted(int(x) for x in expected_list)
    return False


def score_quiz(
    quiz_payload: dict,
    submitted_answers: dict[str, Any],
) -> tuple[float, list[QuestionResult]]:
    """Return (score 0..1, per-question results)."""
    questions: list[dict] = list(quiz_payload.get("questions", []))
    if not questions:
        return 0.0, []

    results: list[QuestionResult] = []
    correct_count = 0
    for q in questions:
        qid = q.get("id")
        qtype = q.get("type")
        correct_value = q.get("correct")
        submitted = submitted_answers.get(qid)
        is_correct = _answer_matches(qtype, correct_value, submitted)
        if is_correct:
            correct_count += 1
        results.append(
            QuestionResult(
                question_id=qid,
                correct=is_correct,
                explanation=q.get("explanation"),
                correct_answer=correct_value,
            )
        )
    score = correct_count / len(questions)
    return score, results
