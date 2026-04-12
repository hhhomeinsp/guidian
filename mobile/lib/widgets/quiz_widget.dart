import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/models.dart';

/// Native Flutter quiz widget matching the web's `Quiz` component.
/// Submits answers to the server via `POST /lessons/{id}/quiz/attempts`
/// for authoritative scoring — never trusts client computation.
class QuizWidget extends StatefulWidget {
  final QuizPayload quiz;
  final String lessonId;
  final ApiClient api;

  const QuizWidget({
    super.key,
    required this.quiz,
    required this.lessonId,
    required this.api,
  });

  @override
  State<QuizWidget> createState() => _QuizWidgetState();
}

class _QuizWidgetState extends State<QuizWidget> {
  final Map<String, dynamic> _answers = {};
  bool _submitted = false;
  bool _loading = false;
  Map<String, dynamic>? _result;

  Future<void> _submit() async {
    setState(() => _loading = true);
    try {
      // Build the answers payload matching the server's schema
      final body = <String, dynamic>{};
      for (final q in widget.quiz.questions) {
        final a = _answers[q.id];
        if (a == null) continue;
        if (q.type == 'true_false') {
          body[q.id] = a as bool;
        } else if (q.type == 'single_choice') {
          body[q.id] = (a as List<int>).first;
        } else {
          body[q.id] = a as List<int>;
        }
      }
      final res = await widget.api.post(
        '/lessons/${widget.lessonId}/quiz/attempts',
        body: {'answers': body},
      );
      setState(() {
        _result = res;
        _submitted = true;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Submit failed: $e')),
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Knowledge check',
            style: theme.textTheme.titleMedium
                ?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        for (var i = 0; i < widget.quiz.questions.length; i++) ...[
          _QuestionCard(
            index: i,
            question: widget.quiz.questions[i],
            value: _answers[widget.quiz.questions[i].id],
            submitted: _submitted,
            serverFeedback: _submitted ? _feedbackFor(widget.quiz.questions[i].id) : null,
            onChanged: (v) {
              setState(() => _answers[widget.quiz.questions[i].id] = v);
            },
          ),
          const SizedBox(height: 12),
        ],
        if (_submitted && _result != null) ...[
          Card(
            color: (_result!['passed'] == true)
                ? Colors.green.withOpacity(0.1)
                : Colors.red.withOpacity(0.1),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                'Score: ${((_result!['score'] as num) * 100).round()}% — '
                '${_result!['passed'] == true ? 'Passed' : 'Not yet passing'}',
                style: theme.textTheme.titleSmall,
              ),
            ),
          ),
          const SizedBox(height: 12),
        ],
        FilledButton(
          onPressed: _submitted || _loading ? null : _submit,
          child: _loading
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(_submitted ? 'Submitted' : 'Submit answers'),
        ),
      ],
    );
  }

  Map<String, dynamic>? _feedbackFor(String questionId) {
    if (_result == null) return null;
    final perQ = _result!['per_question'] as List?;
    if (perQ == null) return null;
    for (final r in perQ) {
      if (r['question_id'] == questionId) return r;
    }
    return null;
  }
}

class _QuestionCard extends StatelessWidget {
  final int index;
  final QuizQuestion question;
  final dynamic value;
  final bool submitted;
  final Map<String, dynamic>? serverFeedback;
  final ValueChanged<dynamic> onChanged;

  const _QuestionCard({
    required this.index,
    required this.question,
    required this.value,
    required this.submitted,
    this.serverFeedback,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isCorrect = serverFeedback?['correct'] as bool?;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Q${index + 1}. ${question.prompt}',
              style: theme.textTheme.bodyMedium
                  ?.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 12),
            if (question.type == 'true_false')
              Row(
                children: [true, false].map((tf) {
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(tf ? 'True' : 'False'),
                      selected: value == tf,
                      onSelected: submitted ? null : (_) => onChanged(tf),
                    ),
                  );
                }).toList(),
              )
            else
              ...List.generate(question.choices.length, (ci) {
                final selected = question.type == 'multiple_choice'
                    ? (value as List<int>?)?.contains(ci) ?? false
                    : (value as List<int>?)?.first == ci;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: ChoiceChip(
                    label: Text(question.choices[ci]),
                    selected: selected,
                    onSelected: submitted
                        ? null
                        : (_) {
                            if (question.type == 'multiple_choice') {
                              final cur = List<int>.from(value ?? []);
                              if (cur.contains(ci)) {
                                cur.remove(ci);
                              } else {
                                cur.add(ci);
                              }
                              onChanged(cur);
                            } else {
                              onChanged([ci]);
                            }
                          },
                  ),
                );
              }),
            if (submitted && serverFeedback != null)
              Container(
                margin: const EdgeInsets.only(top: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  color: isCorrect == true
                      ? Colors.green.withOpacity(0.1)
                      : Colors.red.withOpacity(0.1),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      isCorrect == true ? Icons.check_circle : Icons.cancel,
                      size: 18,
                      color: isCorrect == true ? Colors.green : Colors.red,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        serverFeedback!['explanation'] ??
                            (isCorrect == true ? 'Correct' : 'Incorrect'),
                        style: theme.textTheme.bodySmall,
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
