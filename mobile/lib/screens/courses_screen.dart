import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import 'course_detail_screen.dart';

class CoursesScreen extends StatefulWidget {
  final ApiClient api;
  final VoidCallback onLogout;

  const CoursesScreen({super.key, required this.api, required this.onLogout});

  @override
  State<CoursesScreen> createState() => _CoursesScreenState();
}

class _CoursesScreenState extends State<CoursesScreen> {
  List<Course>? _courses;
  Set<String> _enrolledIds = {};
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final courses = (await widget.api.get('/courses') as List)
          .map((c) => Course.fromJson(c))
          .toList();
      final enrollments = (await widget.api.get('/enrollments/me') as List)
          .map((e) => Enrollment.fromJson(e))
          .toList();
      setState(() {
        _courses = courses;
        _enrolledIds = enrollments.map((e) => e.courseId).toSet();
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _enroll(Course course) async {
    try {
      await widget.api.post('/enrollments', body: {'course_id': course.id});
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Enroll failed: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Guidian'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: widget.onLogout,
            tooltip: 'Sign out',
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _courses?.length ?? 0,
                    itemBuilder: (ctx, i) {
                      final course = _courses![i];
                      final enrolled = _enrolledIds.contains(course.id);
                      return _CourseCard(
                        course: course,
                        enrolled: enrolled,
                        onEnroll: () => _enroll(course),
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => CourseDetailScreen(
                              api: widget.api,
                              courseId: course.id,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}

class _CourseCard extends StatelessWidget {
  final Course course;
  final bool enrolled;
  final VoidCallback onEnroll;
  final VoidCallback onTap;

  const _CourseCard({
    required this.course,
    required this.enrolled,
    required this.onEnroll,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: enrolled ? onTap : null,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(course.title,
                  style: theme.textTheme.titleMedium
                      ?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              if (course.description != null)
                Text(course.description!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall),
              const SizedBox(height: 12),
              Row(
                children: [
                  Chip(
                    label: Text('${course.ceuHours} CEU'),
                    padding: EdgeInsets.zero,
                    visualDensity: VisualDensity.compact,
                  ),
                  const SizedBox(width: 8),
                  Text(course.status.toUpperCase(),
                      style: theme.textTheme.labelSmall),
                  const Spacer(),
                  enrolled
                      ? FilledButton(
                          onPressed: onTap,
                          child: const Text('Continue'),
                        )
                      : OutlinedButton(
                          onPressed: onEnroll,
                          child: const Text('Enroll'),
                        ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
