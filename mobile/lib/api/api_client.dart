import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';
import 'auth_storage.dart';

/// Thrown when a non-2xx status code is received.
class ApiException implements Exception {
  final int statusCode;
  final String message;
  final dynamic body;
  ApiException(this.statusCode, this.message, [this.body]);

  @override
  String toString() => 'ApiException($statusCode): $message';
}

/// HTTP client wrapping JWT auth, automatic token refresh on 401, and
/// JSON encoding/decoding. Mirrors the web's `lib/api/client.ts`.
class ApiClient {
  final AuthStorage _auth;

  ApiClient({AuthStorage? authStorage})
      : _auth = authStorage ?? AuthStorage();

  // --- Auth helpers -------------------------------------------------------

  Future<Map<String, String>> _headers() async {
    final token = await _auth.accessToken;
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<bool> _tryRefresh() async {
    final refresh = await _auth.refreshToken;
    if (refresh == null) return false;
    final res = await http.post(
      Uri.parse('${Config.apiBaseUrl}/auth/refresh'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'refresh_token': refresh}),
    );
    if (res.statusCode != 200) {
      await _auth.clear();
      return false;
    }
    final pair = jsonDecode(res.body);
    await _auth.store(
      accessToken: pair['access_token'],
      refreshToken: pair['refresh_token'],
    );
    return true;
  }

  // --- Core request method ------------------------------------------------

  Future<dynamic> request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? queryParams,
  }) async {
    final uri = Uri.parse('${Config.apiBaseUrl}$path')
        .replace(queryParameters: queryParams);

    http.Response res = await _send(method, uri, body);

    // Transparent refresh on 401
    if (res.statusCode == 401) {
      final refreshed = await _tryRefresh();
      if (refreshed) {
        res = await _send(method, uri, body);
      }
    }

    if (res.statusCode == 204) return null;
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return res.body.isNotEmpty ? jsonDecode(res.body) : null;
    }
    dynamic errBody;
    try {
      errBody = jsonDecode(res.body);
    } catch (_) {}
    throw ApiException(res.statusCode, res.reasonPhrase ?? '', errBody);
  }

  Future<http.Response> _send(
    String method,
    Uri uri,
    Map<String, dynamic>? body,
  ) async {
    final headers = await _headers();
    switch (method) {
      case 'GET':
        return http.get(uri, headers: headers);
      case 'POST':
        return http.post(uri, headers: headers, body: jsonEncode(body ?? {}));
      case 'PUT':
        return http.put(uri, headers: headers, body: jsonEncode(body ?? {}));
      case 'PATCH':
        return http.patch(uri, headers: headers, body: jsonEncode(body ?? {}));
      case 'DELETE':
        return http.delete(uri, headers: headers);
      default:
        throw UnsupportedError('Unsupported HTTP method: $method');
    }
  }

  // --- Convenience --------------------------------------------------------

  Future<dynamic> get(String path, {Map<String, String>? query}) =>
      request('GET', path, queryParams: query);
  Future<dynamic> post(String path, {Map<String, dynamic>? body}) =>
      request('POST', path, body: body);
  Future<dynamic> put(String path, {Map<String, dynamic>? body}) =>
      request('PUT', path, body: body);

  // --- Auth endpoints -----------------------------------------------------

  Future<Map<String, dynamic>> login(String email, String password) async {
    final res = await post('/auth/login', body: {
      'email': email,
      'password': password,
    });
    await _auth.store(
      accessToken: res['access_token'],
      refreshToken: res['refresh_token'],
    );
    return res;
  }

  Future<void> logout() async {
    await _auth.clear();
  }

  Future<Map<String, dynamic>?> me() async {
    try {
      return await get('/users/me');
    } on ApiException catch (e) {
      if (e.statusCode == 401) return null;
      rethrow;
    }
  }

  AuthStorage get auth => _auth;
}
