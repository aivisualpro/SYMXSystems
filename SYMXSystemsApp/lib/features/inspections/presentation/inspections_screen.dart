import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/models/route_row.dart';
import '../../../shared/widgets/error_retry_card.dart';
import '../../auth/data/auth_repository.dart';
import '../data/routes_repository.dart';
import 'inspection_form_screen.dart';
import 'inspection_detail_screen.dart';
import 'inspection_widgets.dart';

// ─── Local State ───────────────────────────────────────────────────
final _selectedDateProvider = StateProvider<String>((ref) => todayLA());
final _selectedWeekProvider = StateProvider<String>((ref) {
  final today = DateTime.tryParse(todayLA()) ?? DateTime.now();
  return dateToYearWeek(today);
});

/// Daily Inspections screen — shows the driver's own routes for a
/// selected day/week with route cards, date scroller, and week
/// selector.
class InspectionsScreen extends ConsumerWidget {
  const InspectionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedDate = ref.watch(_selectedDateProvider);
    final selectedWeek = ref.watch(_selectedWeekProvider);
    final screenWidth = MediaQuery.of(context).size.width;
    final isWide = screenWidth >= 900;

    final routesAsync = ref.watch(
      myRoutesProvider(RoutesParam(yearWeek: selectedWeek, date: selectedDate)),
    );

    final employee = ref.watch(currentEmployeeProvider);

    return Scaffold(
      body: Column(
        children: [
          // ── Top Bar: Date scroller + Week chip ──
          _TopBar(
            selectedDate: selectedDate,
            selectedWeek: selectedWeek,
            employee: employee.valueOrNull,
            onDateSelected: (d) {
              ref.read(_selectedDateProvider.notifier).state = isoDate(d);
            },
            onWeekChanged: (w) {
              ref.read(_selectedWeekProvider.notifier).state = w;
              // Jump to Monday of the new week.
              final dates = weekDates(w);
              if (dates.isNotEmpty) {
                ref.read(_selectedDateProvider.notifier).state =
                    isoDate(dates.first);
              }
            },
            onRefresh: () {
              ref.invalidate(myRoutesProvider(
                RoutesParam(yearWeek: selectedWeek, date: selectedDate),
              ));
            },
          ),

          // ── Body ──
          Expanded(
            child: isWide
                ? Row(
                    children: [
                      // Mini sidebar — 7-day vertical picker
                      _WeekSidebar(
                        selectedWeek: selectedWeek,
                        selectedDate: selectedDate,
                        onDateSelected: (d) {
                          ref.read(_selectedDateProvider.notifier).state =
                              isoDate(d);
                        },
                      ),
                      const VerticalDivider(width: 1),
                      // Route list
                      Expanded(
                        child: _RoutesList(
                          routesAsync: routesAsync,
                          isWide: isWide,
                          onRetry: () => ref.invalidate(myRoutesProvider(
                            RoutesParam(
                                yearWeek: selectedWeek, date: selectedDate),
                          )),
                        ),
                      ),
                    ],
                  )
                : RefreshIndicator(
                    color: AppTheme.primaryIndigo,
                    onRefresh: () async {
                      ref.invalidate(myRoutesProvider(
                        RoutesParam(
                          yearWeek: selectedWeek,
                          date: selectedDate,
                        ),
                      ));
                      // Wait a moment for the provider to re-fetch.
                      await Future.delayed(const Duration(milliseconds: 500));
                    },
                    child: _RoutesList(
                      routesAsync: routesAsync,
                      isWide: false,
                      onRetry: () => ref.invalidate(myRoutesProvider(
                        RoutesParam(yearWeek: selectedWeek, date: selectedDate),
                      )),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// TOP BAR
// ═══════════════════════════════════════════════════════════════════

class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.selectedDate,
    required this.selectedWeek,
    required this.employee,
    required this.onDateSelected,
    required this.onWeekChanged,
    required this.onRefresh,
  });

  final String selectedDate;
  final String selectedWeek;
  final Employee? employee;
  final ValueChanged<DateTime> onDateSelected;
  final ValueChanged<String> onWeekChanged;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final dates = weekDates(selectedWeek);

    // Parse week number for display.
    final weekParts = selectedWeek.split('-W');
    final weekNum = weekParts.length == 2 ? weekParts[1] : '?';
    final weekYear = weekParts.isNotEmpty ? weekParts[0] : '';

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppTheme.surfaceDark : Colors.white,
        border: Border(
          bottom: BorderSide(
            color: isDark ? AppTheme.dividerDark : AppTheme.dividerLight,
          ),
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // ── Week chip + refresh + avatar ──
              Row(
                children: [
                  // Week chip
                  GestureDetector(
                    onTap: () => _showWeekPicker(context),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryIndigo.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: AppTheme.primaryIndigo.withValues(alpha: 0.2),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.calendar_today_rounded,
                            size: 14,
                            color: AppTheme.primaryIndigo,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'Week $weekNum, $weekYear',
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.primaryIndigo,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Icon(
                            Icons.keyboard_arrow_down_rounded,
                            size: 16,
                            color: AppTheme.primaryIndigo,
                          ),
                        ],
                      ),
                    ),
                  ),

                  const Spacer(),

                  // Refresh
                  IconButton(
                    onPressed: onRefresh,
                    icon: Icon(
                      Icons.refresh_rounded,
                      size: 20,
                      color: isDark
                          ? AppTheme.textSecondaryDark
                          : AppTheme.textSecondary,
                    ),
                    visualDensity: VisualDensity.compact,
                  ),
                ],
              ),

              const SizedBox(height: 10),

              // ── Horizontal date scroller ──
              SizedBox(
                height: 62,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: dates.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 6),
                  itemBuilder: (_, i) {
                    final d = dates[i];
                    final iso = isoDate(d);
                    final isSelected = iso == selectedDate;
                    final isToday = iso == todayLA();

                    return GestureDetector(
                      onTap: () => onDateSelected(d),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        width: 52,
                        decoration: BoxDecoration(
                          color: isSelected
                              ? AppTheme.primaryIndigo
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(14),
                          border: isToday && !isSelected
                              ? Border.all(
                                  color: AppTheme.accentEmerald
                                      .withValues(alpha: 0.5),
                                  width: 1.5,
                                )
                              : null,
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              dayLabel(d),
                              style: GoogleFonts.inter(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: isSelected
                                    ? Colors.white.withValues(alpha: 0.7)
                                    : theme.textTheme.bodySmall?.color,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${d.day}',
                              style: GoogleFonts.inter(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                color: isSelected
                                    ? Colors.white
                                    : theme.textTheme.bodyLarge?.color,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showWeekPicker(BuildContext context) {
    final weekParts = selectedWeek.split('-W');
    final currentWeekNum =
        int.tryParse(weekParts.length == 2 ? weekParts[1] : '1') ?? 1;
    final year = weekParts.isNotEmpty ? weekParts[0] : '${DateTime.now().year}';

    // Determine maximum week to show (current real week)
    final todayStr = todayLA();
    final todayDate = DateTime.tryParse(todayStr) ?? DateTime.now();
    final todayYW = dateToYearWeek(todayDate);
    final todayParts = todayYW.split('-W');
    final maxWeek = (todayParts.length == 2)
        ? (int.tryParse(todayParts[1]) ?? 52)
        : 52;

    // Approximate tile height for scrolling to the current week
    const double tileHeight = 48.0;
    final initialOffset =
        ((currentWeekNum - 1) * tileHeight).clamp(0.0, maxWeek * tileHeight);

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        final scrollController =
            ScrollController(initialScrollOffset: initialOffset);
        return SizedBox(
          height: 320,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  'Select Week — $year',
                  style: GoogleFonts.inter(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Expanded(
                child: ListView.builder(
                  controller: scrollController,
                  itemCount: maxWeek,
                  itemBuilder: (_, i) {
                    final w = i + 1;
                    final label = '$year-W${w.toString().padLeft(2, '0')}';
                    final isCurrent = w == currentWeekNum;

                    return ListTile(
                      dense: true,
                      selected: isCurrent,
                      selectedTileColor:
                          AppTheme.primaryIndigo.withValues(alpha: 0.1),
                      title: Text(
                        'Week $w',
                        style: GoogleFonts.inter(
                          fontWeight:
                              isCurrent ? FontWeight.w700 : FontWeight.w400,
                          color: isCurrent ? AppTheme.primaryIndigo : null,
                        ),
                      ),
                      onTap: () {
                        Navigator.pop(ctx);
                        onWeekChanged(label);
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Handles tapping a route card: opens the inspection form for
/// uninspected routes, or the detail screen for already-inspected ones.
/// When the form pops with `true` (successful submit), invalidates the
/// routes provider so the card flips to "Inspected" immediately.
Future<void> _onRouteTap(BuildContext context, RouteRow route, WidgetRef ref) async {
  if (route.isInspected && route.inspectionId.isNotEmpty) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ProviderScope(
          parent: ProviderScope.containerOf(context),
          child: InspectionDetailScreen(inspectionId: route.inspectionId),
        ),
      ),
    );
  } else {
    final result = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => ProviderScope(
          parent: ProviderScope.containerOf(context),
          child: InspectionFormScreen(route: route),
        ),
      ),
    );

    if (result == true && context.mounted) {
      // Optimistic: invalidate so the list refetches with the new inspection
      final selectedDate = ref.read(_selectedDateProvider);
      final selectedWeek = ref.read(_selectedWeekProvider);
      ref.invalidate(myRoutesProvider(
        RoutesParam(yearWeek: selectedWeek, date: selectedDate),
      ));

      // Floating success snack in the bottom-right (Sonner-style)
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
              const SizedBox(width: 8),
              Text(
                'Inspection submitted ✓',
                style: GoogleFonts.inter(
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
            ],
          ),
          backgroundColor: AppTheme.accentEmerald,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          margin: const EdgeInsets.only(bottom: 16, right: 16, left: 200),
          duration: const Duration(seconds: 3),
        ),
      );
    }
  }
}

class _RoutesList extends ConsumerWidget {
  const _RoutesList({
    required this.routesAsync,
    required this.isWide,
    this.onRetry,
  });

  final AsyncValue<RoutesResponse> routesAsync;
  final bool isWide;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return routesAsync.when(
      loading: () => ListView(
        padding: const EdgeInsets.all(16),
        children: List.generate(
          5,
          (i) => const ShimmerCard()
              .animate()
              .shimmer(duration: 1200.ms, delay: (i * 100).ms),
        ),
      ),
      error: (err, _) => ErrorRetryCard(
        message:
            'Could not load your routes. Check your connection and try again.',
        onRetry: onRetry,
      ),
      data: (response) {
        if (response.routes.isEmpty) {
          return ListView(
            children: const [RoutesEmptyState()],
          );
        }

        final routes = response.routes;

        if (isWide) {
          // 2-column grid for wide screens.
          return GridView.builder(
            padding: const EdgeInsets.all(16),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 4,
              crossAxisSpacing: 12,
              mainAxisExtent: 220,
            ),
            itemCount: routes.length,
            itemBuilder: (_, i) {
              return RouteCard(
                route: routes[i],
                onTap: () => _onRouteTap(context, routes[i], ref),
              )
                  .animate()
                  .fadeIn(duration: 200.ms, delay: (i * 40).ms)
                  .slideY(begin: 0.05, end: 0, delay: (i * 40).ms);
            },
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          physics: const AlwaysScrollableScrollPhysics(),
          itemCount: routes.length,
          itemBuilder: (_, i) {
            return RouteCard(
              route: routes[i],
              onTap: () => _onRouteTap(context, routes[i], ref),
            )
                .animate()
                .fadeIn(duration: 200.ms, delay: (i * 40).ms)
                .slideY(begin: 0.05, end: 0, delay: (i * 40).ms);
          },
        );
      },
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// WIDE-SCREEN WEEK SIDEBAR
// ═══════════════════════════════════════════════════════════════════

class _WeekSidebar extends StatelessWidget {
  const _WeekSidebar({
    required this.selectedWeek,
    required this.selectedDate,
    required this.onDateSelected,
  });

  final String selectedWeek;
  final String selectedDate;
  final ValueChanged<DateTime> onDateSelected;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final dates = weekDates(selectedWeek);

    return Container(
      width: 160,
      color: isDark
          ? AppTheme.surfaceDark.withValues(alpha: 0.5)
          : Colors.grey.shade50,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
            child: Text(
              'This Week',
              style: GoogleFonts.inter(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: theme.textTheme.bodySmall?.color,
              ),
            ),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: dates.length,
              itemBuilder: (_, i) {
                final d = dates[i];
                final iso = isoDate(d);
                final isSelected = iso == selectedDate;
                final isToday = iso == todayLA();

                return GestureDetector(
                  onTap: () => onDateSelected(d),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    margin: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 3,
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? AppTheme.primaryIndigo.withValues(alpha: 0.1)
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(10),
                      border: isSelected
                          ? Border.all(
                              color:
                                  AppTheme.primaryIndigo.withValues(alpha: 0.3))
                          : null,
                    ),
                    child: Row(
                      children: [
                        Text(
                          dayLabel(d),
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            fontWeight:
                                isSelected ? FontWeight.w700 : FontWeight.w500,
                            color: isSelected
                                ? AppTheme.primaryIndigo
                                : theme.textTheme.bodySmall?.color,
                          ),
                        ),
                        const Spacer(),
                        Text(
                          shortDate(d),
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: isSelected
                                ? AppTheme.primaryIndigo
                                : theme.textTheme.bodySmall?.color,
                          ),
                        ),
                        if (isToday) ...[
                          const SizedBox(width: 6),
                          Container(
                            width: 6,
                            height: 6,
                            decoration: const BoxDecoration(
                              color: AppTheme.accentEmerald,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
