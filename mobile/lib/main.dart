import 'package:flutter/material.dart';
import 'api/api_client.dart';
import 'screens/login_screen.dart';
import 'screens/courses_screen.dart';

void main() {
  runApp(const GuidianApp());
}

class GuidianApp extends StatefulWidget {
  const GuidianApp({super.key});

  @override
  State<GuidianApp> createState() => _GuidianAppState();
}

class _GuidianAppState extends State<GuidianApp> {
  final ApiClient _api = ApiClient();
  bool _checking = true;
  bool _loggedIn = false;

  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    final me = await _api.me();
    setState(() {
      _loggedIn = me != null;
      _checking = false;
    });
  }

  void _onLoggedIn() {
    setState(() => _loggedIn = true);
  }

  void _onLoggedOut() async {
    await _api.logout();
    setState(() => _loggedIn = false);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Guidian',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF2563EB),
        useMaterial3: true,
        brightness: Brightness.light,
      ),
      darkTheme: ThemeData(
        colorSchemeSeed: const Color(0xFF2563EB),
        useMaterial3: true,
        brightness: Brightness.dark,
      ),
      themeMode: ThemeMode.system,
      home: _checking
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : _loggedIn
              ? CoursesScreen(api: _api, onLogout: _onLoggedOut)
              : LoginScreen(api: _api, onLoggedIn: _onLoggedIn),
    );
  }
}
