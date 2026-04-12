/// Minimal Dart models mirroring the Pydantic schemas the mobile app consumes.
/// Full codegen from the OpenAPI spec is the recommended production approach.

class Course {
  final String id;
  final String title;
  final String? description;
  final String status;
  final double ceuHours;
  final String? accreditingBody;
  final List<Module>? modules;

  Course({
    required this.id,
    required this.title,
    this.description,
    required this.status,
    required this.ceuHours,
    this.accreditingBody,
    this.modules,
  });

  factory Course.fromJson(Map<String, dynamic> json) => Course(
        id: json['id'],
        title: json['title'],
        description: json['description'],
        status: json['status'],
        ceuHours: (json['ceu_hours'] as num).toDouble(),
        accreditingBody: json['accrediting_body'],
        modules: (json['modules'] as List<dynamic>?)
            ?.map((m) => Module.fromJson(m))
            .toList(),
      );
}

class Module {
  final String id;
  final String title;
  final String? description;
  final int orderIndex;
  final List<Lesson> lessons;

  Module({
    required this.id,
    required this.title,
    this.description,
    required this.orderIndex,
    required this.lessons,
  });

  factory Module.fromJson(Map<String, dynamic> json) => Module(
        id: json['id'],
        title: json['title'],
        description: json['description'],
        orderIndex: json['order_index'],
        lessons: (json['lessons'] as List<dynamic>)
            .map((l) => Lesson.fromJson(l))
            .toList(),
      );
}

class Lesson {
  final String id;
  final String moduleId;
  final String title;
  final int orderIndex;
  final List<String> objectives;
  final String mdxContent;
  final String? audioUrl;
  final List<String> styleTags;
  final int clockMinutes;
  final QuizPayload quiz;

  Lesson({
    required this.id,
    required this.moduleId,
    required this.title,
    required this.orderIndex,
    required this.objectives,
    required this.mdxContent,
    this.audioUrl,
    required this.styleTags,
    required this.clockMinutes,
    required this.quiz,
  });

  factory Lesson.fromJson(Map<String, dynamic> json) => Lesson(
        id: json['id'],
        moduleId: json['module_id'],
        title: json['title'],
        orderIndex: json['order_index'],
        objectives: List<String>.from(json['objectives'] ?? []),
        mdxContent: json['mdx_content'] ?? '',
        audioUrl: json['audio_url'],
        styleTags: List<String>.from(json['style_tags'] ?? []),
        clockMinutes: json['clock_minutes'] ?? 0,
        quiz: QuizPayload.fromJson(json['quiz'] ?? {}),
      );
}

class QuizPayload {
  final List<QuizQuestion> questions;

  QuizPayload({required this.questions});

  factory QuizPayload.fromJson(Map<String, dynamic> json) => QuizPayload(
        questions: (json['questions'] as List<dynamic>?)
                ?.map((q) => QuizQuestion.fromJson(q))
                .toList() ??
            [],
      );
}

class QuizQuestion {
  final String id;
  final String type; // single_choice | multiple_choice | true_false
  final String prompt;
  final List<String> choices;
  final dynamic correct; // int | List<int> | bool
  final String? explanation;

  QuizQuestion({
    required this.id,
    required this.type,
    required this.prompt,
    required this.choices,
    required this.correct,
    this.explanation,
  });

  factory QuizQuestion.fromJson(Map<String, dynamic> json) => QuizQuestion(
        id: json['id'],
        type: json['type'],
        prompt: json['prompt'],
        choices: List<String>.from(json['choices'] ?? []),
        correct: json['correct'],
        explanation: json['explanation'],
      );
}

class Enrollment {
  final String id;
  final String courseId;
  final String status;
  final double progressPct;

  Enrollment({
    required this.id,
    required this.courseId,
    required this.status,
    required this.progressPct,
  });

  factory Enrollment.fromJson(Map<String, dynamic> json) => Enrollment(
        id: json['id'],
        courseId: json['course_id'],
        status: json['status'],
        progressPct: (json['progress_pct'] as num).toDouble(),
      );
}
