import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../core/api/api_client.dart';
import '../../../core/constants/app_constants.dart';

// ─── Employee Model ────────────────────────────────────────────────
/// Lightweight employee DTO returned by the badge-login / me endpoints.
class Employee {
  final String transporterId;
  final String badgeNumber;
  final String firstName;
  final String lastName;
  final String fullName;
  final String profileImage;
  final String type;

  const Employee({
    required this.transporterId,
    required this.badgeNumber,
    required this.firstName,
    required this.lastName,
    required this.fullName,
    required this.profileImage,
    required this.type,
  });

  factory Employee.fromJson(Map<String, dynamic> json) => Employee(
        transporterId: json['transporterId'] ?? '',
        badgeNumber: json['badgeNumber'] ?? '',
        firstName: json['firstName'] ?? '',
        lastName: json['lastName'] ?? '',
        fullName: json['fullName'] ?? '',
        profileImage: json['profileImage'] ?? '',
        type: json['type'] ?? '',
      );

  Map<String, dynamic> toJson() => {
        'transporterId': transporterId,
        'badgeNumber': badgeNumber,
        'firstName': firstName,
        'lastName': lastName,
        'fullName': fullName,
        'profileImage': profileImage,
        'type': type,
      };
}

// ─── Auth Repository ───────────────────────────────────────────────
/// Handles badge-number authentication, token persistence, and
/// employee profile retrieval.
class AuthRepository {
  AuthRepository(this._dio, this._storage);

  final Dio _dio;
  final FlutterSecureStorage _storage;

  /// POST /api/mobile/badge-login
  ///
  /// On success: persists the JWT and serialised employee JSON.
  /// Returns the [Employee] object.
  /// Throws on network or auth failure.
  Future<Employee> login(String badgeNumber) async {
    final response = await _dio.post(
      '/api/mobile/badge-login',
      data: {'badgeNumber': badgeNumber.trim()},
      options: Options(validateStatus: (_) => true),
    );

    final data = response.data;
    if (data['success'] != true) {
      throw Exception(data['error'] ?? 'Login failed');
    }

    final token = data['token'] as String;
    final employee = Employee.fromJson(data['employee']);

    // Persist to secure storage.
    await _storage.write(key: kBadgeTokenKey, value: token);
    await _storage.write(
      key: kEmployeeKey,
      value: jsonEncode(employee.toJson()),
    );

    return employee;
  }

  /// GET /api/mobile/me
  ///
  /// Uses the stored `x-badge-token` header (injected by the Dio
  /// interceptor). Returns the [Employee] or throws 401.
  Future<Employee> me() async {
    final response = await _dio.get('/api/mobile/me');
    final data = response.data;

    if (data['success'] != true) {
      throw Exception(data['error'] ?? 'Unauthorized');
    }

    final employee = Employee.fromJson(data['employee']);

    // Refresh the cached employee data.
    await _storage.write(
      key: kEmployeeKey,
      value: jsonEncode(employee.toJson()),
    );

    return employee;
  }

  /// Returns the locally-cached employee (no network call).
  /// Falls back to `null` if nothing is stored.
  Future<Employee?> cachedEmployee() async {
    final raw = await _storage.read(key: kEmployeeKey);
    if (raw == null || raw.isEmpty) return null;
    try {
      return Employee.fromJson(jsonDecode(raw));
    } catch (_) {
      return null;
    }
  }

  /// Clears all persisted auth data (token + employee).
  Future<void> logout() async {
    await _storage.delete(key: kBadgeTokenKey);
    await _storage.delete(key: kEmployeeKey);
  }

  /// Returns `true` when a badge token exists in storage.
  Future<bool> get hasToken async {
    final token = await _storage.read(key: kBadgeTokenKey);
    return token != null && token.isNotEmpty;
  }
}

// ─── Providers ─────────────────────────────────────────────────────

/// Provides the [AuthRepository] singleton.
final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    ref.read(dioProvider),
    ref.read(secureStorageProvider),
  );
});

/// Async provider that calls `/me` and caches the result.
/// Invalidate this provider on login/logout to re-evaluate.
final currentEmployeeProvider = FutureProvider<Employee?>((ref) async {
  final repo = ref.read(authRepositoryProvider);
  if (!await repo.hasToken) return null;
  try {
    return await repo.me();
  } catch (_) {
    return null;
  }
});
