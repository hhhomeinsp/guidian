import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../config.dart';
import '../widgets/audio_player_widget.dart';
import '../widgets/flashcard_widget.dart';
import '../widgets/quiz_widget.dart';

/// Lesson screen. Course content is rendered in a WebView pointing at the
/// web frontend's lesson player — per the spec:
///   "WebView for course content rendering"
///   "Native Flutter components for quizzes, flashcards, and audio playback"
///
/// Auth is injected into the WebView by writing the JWT to localStorage
/// before navigating to the lesson URL. The localStorage key matches
/// `lib/api/client.ts` on the web side.
class LessonScreen extends StatefulWidget {
  final ApiClient api;
  final String courseId;
  final Lesson lesson;
  final String? moduleTitle;

  const LessonScreen({
    super.key,
    required this.api,
    required this.courseId,
    required this.lesson,
    this.moduleTitle,
  });

  @override
  State<LessonScreen> createState() => _LessonScreenState();
}

class _LessonScreenState extends State<LessonScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  late final WebViewController _webCtrl;
  bool _webReady = false;

  bool get _hasQuiz => widget.lesson.quiz.questions.isNotEmpty;
  bool get _hasAudio => widget.lesson.audioUrl != null;

  @override
  void initState() {
    super.initState();
    final tabCount =
        1 + (_hasQuiz ? 1 : 0) + 1 /* flashcards */ + (_hasAudio ? 1 : 0);
    _tabs = TabController(length: tabCount, vsync: this);
    _initWebView();
  }

  Future<void> _initWebView() async {
    final token = await widget.api.auth.accessToken;
    final url =
        '${Config.webBaseUrl}/courses/${widget.courseId}/lessons/${widget.lesson.id}';

    _webCtrl = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) => setState(() => _webReady = false),
          onPageFinished: (_) => setState(() => _webReady = true),
        ),
      );

    // Inject auth token into the web app's localStorage before loading.
    // We load about:blank first, inject the token, then navigate.
    await _webCtrl.loadRequest(Uri.parse('about:blank'));
    if (token != null) {
      await _webCtrl.runJavaScript(
        "window.localStorage.setItem('guidian.access_token', '$token');",
      );
    }
    await _webCtrl.loadRequest(Uri.parse(url));
  }

  List<Tab> _buildTabs() {
    final tabs = <Tab>[const Tab(text: 'Content')];
    if (_hasQuiz) tabs.add(const Tab(text: 'Quiz'));
    tabs.add(const Tab(text: 'Flashcards'));
    if (_hasAudio) tabs.add(const Tab(text: 'Audio'));
    return tabs;
  }

  List<Widget> _buildPages() {
    final pages = <Widget>[
      // Content tab — WebView
      Stack(
        children: [
          WebViewWidget(controller: _webCtrl),
          if (!_webReady)
            const Center(child: CircularProgressIndicator()),
        ],
      ),
    ];
    if (_hasQuiz) {
      pages.add(
        SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: QuizWidget(
            quiz: widget.lesson.quiz,
            lessonId: widget.lesson.id,
            api: widget.api,
          ),
        ),
      );
    }
    pages.add(
      FlashcardWidget(objectives: widget.lesson.objectives),
    );
    if (_hasAudio) {
      pages.add(
        AudioPlayerWidget(url: widget.lesson.audioUrl!),
      );
    }
    return pages;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.lesson.title),
        bottom: TabBar(
          controller: _tabs,
          isScrollable: true,
          tabs: _buildTabs(),
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: _buildPages(),
      ),
    );
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }
}
