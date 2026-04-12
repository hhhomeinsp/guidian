/// Central configuration for the Guidian mobile app.
///
/// [apiBaseUrl] and [webBaseUrl] should be overridden per environment
/// (development, staging, production) via Flutter's `--dart-define` mechanism:
///
///   flutter run --dart-define=API_BASE_URL=https://guidian-api.onrender.com/api/v1
///   flutter run --dart-define=WEB_BASE_URL=https://guidian-web.onrender.com
class Config {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000/api/v1', // Android emulator → host
  );

  static const String webBaseUrl = String.fromEnvironment(
    'WEB_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );
}
