import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';

/// Repository for submitting inspections from the mobile app.
class InspectionRepository {
  InspectionRepository(this._dio);
  final Dio _dio;

  /// Fetch the last mileage for a VIN.
  Future<int?> getLastMileage(String vin) async {
    if (vin.isEmpty) return null;
    try {
      final res = await _dio.get(
        '/api/mobile/inspections',
        queryParameters: {'vin': vin},
      );
      final mileage = res.data['lastMileage'];
      if (mileage != null) return (mileage as num).toInt();
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Upload a photo and return its URL.
  Future<String?> uploadPhoto(File file) async {
    try {
      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(
          file.path,
          filename: file.path.split('/').last,
        ),
      });
      final res = await _dio.post('/api/admin/upload', data: formData);
      return res.data['secure_url'] as String?;
    } catch (e) {
      return null;
    }
  }

  /// Submit the inspection.
  Future<Map<String, dynamic>> submitInspection(
    Map<String, dynamic> data,
  ) async {
    final res = await _dio.post('/api/mobile/inspections', data: data);
    return res.data as Map<String, dynamic>;
  }
}

final inspectionRepositoryProvider = Provider<InspectionRepository>((ref) {
  return InspectionRepository(ref.read(dioProvider));
});
