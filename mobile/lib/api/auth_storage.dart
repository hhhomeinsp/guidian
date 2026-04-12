import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists JWT tokens in the platform's secure keychain/keystore.
class AuthStorage {
  static const _accessKey = 'guidian.access_token';
  static const _refreshKey = 'guidian.refresh_token';

  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  Future<String?> get accessToken => _storage.read(key: _accessKey);
  Future<String?> get refreshToken => _storage.read(key: _refreshKey);

  Future<void> store({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _storage.write(key: _accessKey, value: accessToken);
    await _storage.write(key: _refreshKey, value: refreshToken);
  }

  Future<void> clear() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
  }
}
