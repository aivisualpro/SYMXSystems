import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../shared/models/route_row.dart';

// ─── Repository ────────────────────────────────────────────────────
/// Fetches driver-scoped routes from the mobile API.
class RoutesRepository {
  RoutesRepository(this._dio);
  final Dio _dio;

  /// GET /api/mobile/my-routes
  ///
  /// The Dio interceptor automatically attaches `x-badge-token`.
  /// Returns a list of [RouteRow] for the given [yearWeek] and
  /// optional [date].
  Future<RoutesResponse> getMyRoutes({
    required String yearWeek,
    String? date,
  }) async {
    final params = <String, dynamic>{'yearWeek': yearWeek};
    if (date != null && date.isNotEmpty) params['date'] = date;

    final response = await _dio.get(
      '/api/mobile/my-routes',
      queryParameters: params,
    );

    final data = response.data;
    final List<dynamic> rawRoutes = data['routes'] ?? [];
    final routes = rawRoutes
        .map((e) => RouteRow.fromJson(e as Map<String, dynamic>))
        .toList();

    return RoutesResponse(
      routes: routes,
      date: data['date'] ?? '',
      yearWeek: data['yearWeek'] ?? yearWeek,
    );
  }
}

/// Response envelope from [RoutesRepository.getMyRoutes].
class RoutesResponse {
  const RoutesResponse({
    required this.routes,
    required this.date,
    required this.yearWeek,
  });
  final List<RouteRow> routes;
  final String date;
  final String yearWeek;
}

// ─── Providers ─────────────────────────────────────────────────────

/// Singleton [RoutesRepository] provider.
final routesRepositoryProvider = Provider<RoutesRepository>((ref) {
  return RoutesRepository(ref.read(dioProvider));
});

/// Parameter class for the route fetcher.
class RoutesParam {
  const RoutesParam({required this.yearWeek, this.date});
  final String yearWeek;
  final String? date;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is RoutesParam && yearWeek == other.yearWeek && date == other.date;

  @override
  int get hashCode => Object.hash(yearWeek, date);
}

/// Async family provider keyed by [RoutesParam].
final myRoutesProvider =
    FutureProvider.family<RoutesResponse, RoutesParam>((ref, param) {
  final repo = ref.read(routesRepositoryProvider);
  return repo.getMyRoutes(yearWeek: param.yearWeek, date: param.date);
});
