import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/api/api_client.dart';
import '../../../core/notifications/push_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/models/route_row.dart';
import '../../../shared/widgets/error_retry_card.dart';
import '../../inspections/data/routes_repository.dart';

/// ISO-8601 week label ("2026-W42") for a date — matches the backend.
String _isoYearWeek(DateTime d) {
  final date = DateTime.utc(d.year, d.month, d.day);
  final thursday = date.add(Duration(days: 4 - (date.weekday)));
  final yearStart = DateTime.utc(thursday.year, 1, 1);
  final week = ((thursday.difference(yearStart).inDays) / 7).floor() + 1;
  return '${thursday.year}-W${week.toString().padLeft(2, '0')}';
}

String _ymd(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// Today's route(s) for the signed-in driver. Re-fetch by invalidating.
final todayRoutesProvider = FutureProvider<RoutesResponse>((ref) {
  final now = DateTime.now();
  return ref
      .read(routesRepositoryProvider)
      .getMyRoutes(yearWeek: _isoYearWeek(now), date: _ymd(now));
});

final _alertsEnabledProvider =
    FutureProvider<bool>((ref) => PushService.instance.alertsEnabled());

/// "Today" tab — the driver's van and route for the day, plus a safety-alert
/// status card with a self-test button (so a freshly issued phone can be
/// verified in seconds).
class TodayScreen extends ConsumerWidget {
  const TodayScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(todayRoutesProvider);
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(todayRoutesProvider);
        ref.invalidate(_alertsEnabledProvider);
        await ref.read(todayRoutesProvider.future).catchError((_) => RoutesResponse(routes: const [], date: '', yearWeek: ''));
      },
      child: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ListView(children: [
          ErrorRetryCard(
            message: 'Could not load today\'s route.',
            onRetry: () => ref.invalidate(todayRoutesProvider),
          ),
        ]),
        data: (resp) {
          final routes = resp.routes
              .where((r) => r.routeNumber.isNotEmpty || r.van.isNotEmpty)
              .toList();
          return ListView(
            padding: const EdgeInsets.all(16),
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              const _AlertStatusCard(),
              const SizedBox(height: 16),
              if (routes.isEmpty)
                const _EmptyCard()
              else
                for (final r in routes) ...[
                  _RouteCard(route: r),
                  const SizedBox(height: 16),
                ],
            ],
          );
        },
      ),
    );
  }
}

// ─── Route / van card ──────────────────────────────────────────────
class _RouteCard extends StatelessWidget {
  const _RouteCard({required this.route});
  final RouteRow route;

  String _vinTail() {
    final v = route.vin.replaceAll(RegExp(r'[^A-Za-z0-9]'), '');
    return v.length >= 6 ? v.substring(v.length - 6).toUpperCase() : v.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final fg = isDark ? AppTheme.textOnDark : AppTheme.textPrimary;
    final sub = isDark ? AppTheme.textSecondaryDark : AppTheme.textSecondary;

    Widget stat(String label, String value, {IconData? icon}) => Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label.toUpperCase(),
                style: GoogleFonts.inter(fontSize: 10, letterSpacing: 0.6, fontWeight: FontWeight.w600, color: sub)),
            const SizedBox(height: 4),
            Text(value.isEmpty ? '—' : value,
                style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: fg)),
          ]),
        );

    return Container(
      padding: AppTheme.cardPadding,
      decoration: BoxDecoration(
        color: isDark ? AppTheme.cardDark : AppTheme.cardLight,
        borderRadius: BorderRadius.circular(AppTheme.borderRadius),
        border: Border.all(color: isDark ? AppTheme.borderDark : AppTheme.dividerLight),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(Icons.local_shipping_rounded, color: AppTheme.primaryIndigo, size: 22),
          const SizedBox(width: 8),
          Expanded(
            child: Text(route.type.isEmpty ? 'Today\'s route' : route.type,
                style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: fg)),
          ),
          if (route.serviceType.isNotEmpty)
            Text(route.serviceType, style: GoogleFonts.inter(fontSize: 12, color: sub)),
        ]),
        const SizedBox(height: 16),
        Row(children: [
          stat('Van', route.van),
          stat('Route', route.routeNumber),
          stat('Wave', route.waveTime),
        ]),
        const SizedBox(height: 16),
        Row(children: [
          stat('Stops', route.stopCount > 0 ? '${route.stopCount}' : ''),
          stat('Packages', route.packageCount > 0 ? '${route.packageCount}' : ''),
          stat('VIN (last 6)', _vinTail()),
        ]),
        if (route.dashcam.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text('Dash cam: ${route.dashcam}', style: GoogleFonts.inter(fontSize: 12, color: sub)),
        ],
      ]),
    );
  }
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard();
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 40),
      child: Column(children: [
        Icon(Icons.event_busy_rounded, size: 48, color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.2)),
        const SizedBox(height: 12),
        Text('No route assigned for today',
            style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: isDark ? AppTheme.textOnDark : AppTheme.textPrimary)),
        const SizedBox(height: 4),
        Text('Pull down to refresh.',
            style: GoogleFonts.inter(fontSize: 13, color: isDark ? AppTheme.textSecondaryDark : AppTheme.textSecondary)),
      ]),
    );
  }
}

// ─── Safety-alert status + test ────────────────────────────────────
class _AlertStatusCard extends ConsumerStatefulWidget {
  const _AlertStatusCard();
  @override
  ConsumerState<_AlertStatusCard> createState() => _AlertStatusCardState();
}

class _AlertStatusCardState extends ConsumerState<_AlertStatusCard> {
  bool _sending = false;
  String? _result;
  bool _resultOk = false;

  Future<void> _test() async {
    setState(() { _sending = true; _result = null; });
    final err = await PushService.instance.sendTestAlert(ref.read(dioProvider));
    if (!mounted) return;
    setState(() {
      _sending = false;
      _resultOk = err == null;
      _result = err ?? 'Test sent — you should hear the alert now.';
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final enabled = ref.watch(_alertsEnabledProvider).valueOrNull;
    final ok = enabled != false;
    final color = ok ? AppTheme.accentEmerald : AppTheme.errorRed;

    return Container(
      padding: AppTheme.cardPadding,
      decoration: BoxDecoration(
        color: color.withValues(alpha: isDark ? 0.12 : 0.08),
        borderRadius: BorderRadius.circular(AppTheme.borderRadius),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(ok ? Icons.notifications_active_rounded : Icons.notifications_off_rounded, color: color),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              ok ? 'Safety alerts are on' : 'Safety alerts are BLOCKED — ask dispatch to enable notifications for this app',
              style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: isDark ? AppTheme.textOnDark : AppTheme.textPrimary),
            ),
          ),
        ]),
        const SizedBox(height: 4),
        Text('You\'ll hear an alert if the camera flags a safety event while you\'re signed in.',
            style: GoogleFonts.inter(fontSize: 12, color: isDark ? AppTheme.textSecondaryDark : AppTheme.textSecondary)),
        const SizedBox(height: 12),
        Row(children: [
          OutlinedButton.icon(
            onPressed: _sending ? null : _test,
            icon: _sending
                ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.volume_up_rounded, size: 18),
            label: const Text('Send test alert'),
          ),
          if (_result != null) ...[
            const SizedBox(width: 12),
            Expanded(
              child: Text(_result!, style: GoogleFonts.inter(fontSize: 12, color: _resultOk ? AppTheme.accentEmerald : AppTheme.errorRed)),
            ),
          ],
        ]),
      ]),
    );
  }
}
