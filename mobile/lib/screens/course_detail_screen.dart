import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import 'lesson_screen.dart';

class CourseDetailScreen extends StatefulWidget {
  final ApiClient api;
  final String courseId;

  const CourseDetailScreen({
    super.key,
    required this.api,
    required this.courseId,
  });

  @override
  State<CourseDetailScreen> createState() => _CourseDetailScreenState();
}

class _CourseDetailScreenState extends State<CourseDetailScreen> {
  Course? _course;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final json = await widget.api.get('/courses/${widget.courseId}');
    setState(() {
      _course = Course.fromJson(json);
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(_course?.title ?? 'Course')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _course == null
              ? const Center(child: Text('Course not found'))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (_course!.description != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: Text(
                          _course!.description!,
                          style: theme.textTheme.bodyMedium,
                        ),
                      ),
                    Row(
                      children: [
                        Chip(label: Text('${_course!.ceuHours} CEU')),
                        if (_course!.accreditingBody != null) ...[
                          const SizedBox(width: 8),
                          Chip(label: Text(_course!.accreditingBody!)),
                        ],
                      ],
                    ),
                    const SizedBox(height: 24),
                    for (var mi = 0;
                        mi < (_course!.modules?.length ?? 0);
                        mi++) ...[
                      _ModuleSection(
                        module: _course!.modules![mi],
                        moduleIndex: mi,
                        onLessonTap: (lesson) => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => LessonScreen(
                              api: widget.api,
                              courseId: _course!.id,
                              lesson: lesson,
                              moduleTitle: _course!.modules![mi].title,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
    );
  }
}

class _ModuleSection extends StatelessWidget {
  final Module module;
  final int moduleIndex;
  final ValueChanged<Lesson> onLessonTap;

  const _ModuleSection({
    required this.module,
    required this.moduleIndex,
    required this.onLessonTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Text(
            'Module ${moduleIndex + 1}: ${module.title}',
            style: theme.textTheme.titleSmall
                ?.copyWith(fontWeight: FontWeight.bold),
          ),
        ),
        ...module.lessons.map(
          (l) => ListTile(
            leading: CircleAvatar(
              radius: 16,
              child: Text('${moduleIndex + 1}.${l.orderIndex + 1}',
                  style: const TextStyle(fontSize: 12)),
            ),
            title: Text(l.title, style: theme.textTheme.bodyMedium),
            subtitle: Text('${l.clockMinutes} min'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => onLessonTap(l),
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}
