import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../constants/app_constants.dart';
import '../router/app_router.dart';

// ─── Secure Storage Provider ───────────────────────────────────────
/// Shared instance of [FlutterSecureStorage] used across the app.
final secureStorageProvider = Provider<FlutterSecureStorage>(
  (_) => const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  ),
);

// ─── Dio Provider ──────────────────────────────────────────────────
/// Provides a pre-configured [Dio] instance.
///
/// • Base URL points to [kApiBaseUrl].
/// • [_AuthInterceptor] attaches the `x-badge-token` header when
///   a token is present in secure storage.
/// • A [LogInterceptor] is added in debug builds only.
final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: kApiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ),
  );

  // Attach the auth interceptor.
  final storage = ref.read(secureStorageProvider);
  dio.interceptors.add(_AuthInterceptor(storage));

  // Global 401 handler — clear auth state and redirect to login.
  dio.interceptors.add(_UnauthorizedInterceptor(() async {
    await storage.delete(key: kBadgeTokenKey);
    await storage.delete(key: kEmployeeKey);
    ref.read(routerProvider).go('/login');
  }));

  // Debug-only logging.
  if (kDebugMode) {
    dio.interceptors.add(
      LogInterceptor(
        requestBody: true,
        responseBody: true,
        logPrint: (obj) => debugPrint('[DIO] $obj'),
      ),
    );
  }

  return dio;
});

// ─── Auth Interceptor ──────────────────────────────────────────────
/// Reads the JWT badge-token from [FlutterSecureStorage] and attaches
/// it as the `x-badge-token` header on every outgoing request.
class _AuthInterceptor extends Interceptor {
  _AuthInterceptor(this._storage);

  final FlutterSecureStorage _storage;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _storage.read(key: kBadgeTokenKey);
    if (token != null && token.isNotEmpty) {
      options.headers['x-badge-token'] = token;
    }
    handler.next(options);
  }
}

// ─── 401 Interceptor ───────────────────────────────────────────────
/// Intercepts 401 responses from `/api/mobile/*` endpoints and
/// triggers a forced logout + redirect to the login screen.
class _UnauthorizedInterceptor extends Interceptor {
  _UnauthorizedInterceptor(this._onUnauthorized);

  final Future<void> Function() _onUnauthorized;

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode == 401 &&
        err.requestOptions.path.startsWith('/api/mobile/')) {
      _onUnauthorized();
    }
    handler.next(err);
  }
}
