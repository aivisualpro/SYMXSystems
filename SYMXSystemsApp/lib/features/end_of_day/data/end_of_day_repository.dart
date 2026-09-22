import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';

/// One end-of-day checklist item, as returned by
/// GET /api/mobile/end-of-day-tasks.
class EndOfDayTask {
  final String id;
  final String title;
  final String description;
  final bool requiresPhoto;
  final bool completed;

  const EndOfDayTask({
    required this.id,
    required this.title,
    required this.description,
    required this.requiresPhoto,
    required this.completed,
  });

  factory EndOfDayTask.fromJson(Map<String, dynamic> json) => EndOfDayTask(
        id: json['_id'] ?? '',
        title: json['title'] ?? '',
        description: json['description'] ?? '',
        requiresPhoto: json['requiresPhoto'] ?? false,
        completed: json['completed'] ?? false,
      );

  EndOfDayTask copyWith({bool? completed}) => EndOfDayTask(
        id: id,
        title: title,
        description: description,
        requiresPhoto: requiresPhoto,
        completed: completed ?? this.completed,
      );
}

/// Repository for the driver app's end-of-day checklist.
class EndOfDayRepository {
  EndOfDayRepository(this._dio);
  final Dio _dio;

  /// Fetch today's tasks + completion status.
  Future<List<EndOfDayTask>> getTasks() async {
    final res = await _dio.get('/api/mobile/end-of-day-tasks');
    final tasks = (res.data['tasks'] as List<dynamic>? ?? [])
        .map((t) => EndOfDayTask.fromJson(t as Map<String, dynamic>))
        .toList();
    return tasks;
  }

  /// Upload a photo and return its URL — same endpoint/shape the
  /// inspections feature uses.
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
    } catch (_) {
      return null;
    }
  }

  /// Mark a task complete (with a photo URL if it requires one).
  Future<void> completeTask(String templateId, {String? photoUrl}) async {
    await _dio.post('/api/mobile/end-of-day-tasks', data: {
      'templateId': templateId,
      if (photoUrl != null) 'photoUrl': photoUrl,
    });
  }

  /// Undo a completed task (tapped by mistake).
  Future<void> uncompleteTask(String templateId) async {
    await _dio.delete(
      '/api/mobile/end-of-day-tasks',
      queryParameters: {'templateId': templateId},
    );
  }
}

final endOfDayRepositoryProvider = Provider<EndOfDayRepository>((ref) {
  return EndOfDayRepository(ref.read(dioProvider));
});
