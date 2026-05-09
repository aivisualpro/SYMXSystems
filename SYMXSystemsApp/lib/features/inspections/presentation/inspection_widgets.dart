import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/models/route_row.dart';

// ═══════════════════════════════════════════════════════════════════
// ROUTE TYPE COLORS — ported from lib/route-types.ts
// ═══════════════════════════════════════════════════════════════════

/// Returns [Color] for a given route type name.
/// Falls back to the `typeColor` hex from the backend API if the
/// type is not in the hardcoded map.
Color getTypeColor(String type, [String fallbackHex = '#6B7280']) {
  final key = type.trim().toLowerCase();
  final mapped = _kTypeColors[key];
  if (mapped != null) return mapped;
  return _hexToColor(fallbackHex);
}

const _kTypeColors = <String, Color>{
  'route': Color(0xFF06923E),
  'off': Color(0xFF686D76),
  'open': Color(0xFFFF8383),
  'close': Color(0xFFF9B2D7),
  'rescue': Color(0xFF7DAACB),
  'call out': Color(0xFFE52020),
  'amz training': Color(0xFF8F0177),
  'reduction': Color(0xFF281C59),
  'c0': Color(0xFFFF8B5A),
  'trainer': Color(0xFFD8D365),
  'training otr': Color(0xFFDDA853),
  'crash': Color(0xFF0D92F4),
  'fleet': Color(0xFF27548A),
  'pending ecp': Color(0xFF5D1C6A),
  'suspension': Color(0xFF313E17),
  'modified duty': Color(0xFF4D4646),
  'stand by': Color(0xFFF29727),
  'request off': Color(0xFF9AA6B2),
  'tco': Color(0xFFCA6180),
};

Color _hexToColor(String hex) {
  final clean = hex.replaceFirst('#', '');
  if (clean.length == 6) {
    return Color(int.parse('FF$clean', radix: 16));
  }
  return const Color(0xFF6B7280);
}

// ═══════════════════════════════════════════════════════════════════
// DATE HELPERS
// ═══════════════════════════════════════════════════════════════════

/// Returns today's date (YYYY-MM-DD) in America/Los_Angeles.
String todayLA() {
  // Dart doesn't have tz database built-in; we approximate by
  // using UTC-7 (PDT) which covers most of the year.
  // For production accuracy, use the `timezone` package.
  final now = DateTime.now().toUtc().subtract(const Duration(hours: 7));
  return '${now.year}-${_pad(now.month)}-${_pad(now.day)}';
}

String _pad(int v) => v.toString().padLeft(2, '0');

/// Returns the ISO yearWeek string (e.g. "2026-W19") for a date.
String dateToYearWeek(DateTime d) {
  final dayOfWeek = d.weekday; // Mon=1 … Sun=7
  final thursday = d.add(Duration(days: 4 - dayOfWeek));
  final yearStart = DateTime(thursday.year, 1, 1);
  final weekNo =
      ((thursday.difference(yearStart).inDays) / 7).ceil() + 1;
  return '${thursday.year}-W${weekNo.toString().padLeft(2, '0')}';
}

/// Returns the 7 dates (Mon→Sun) of the ISO week.
List<DateTime> weekDates(String yearWeek) {
  final parts = yearWeek.split('-W');
  if (parts.length != 2) return [];
  final year = int.tryParse(parts[0]) ?? DateTime.now().year;
  final week = int.tryParse(parts[1]) ?? 1;
  // Jan 4 is always in week 1
  final jan4 = DateTime(year, 1, 4);
  final monday = jan4.subtract(Duration(days: jan4.weekday - 1));
  final weekMonday = monday.add(Duration(days: (week - 1) * 7));
  return List.generate(7, (i) => weekMonday.add(Duration(days: i)));
}

/// Short weekday label.
const _kDayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
String dayLabel(DateTime d) => _kDayLabels[d.weekday - 1];

/// Format date as "May 9".
String shortDate(DateTime d) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return '${months[d.month - 1]} ${d.day}';
}

/// Format date as YYYY-MM-DD.
String isoDate(DateTime d) =>
    '${d.year}-${_pad(d.month)}-${_pad(d.day)}';

// ═══════════════════════════════════════════════════════════════════
// SHIMMER PLACEHOLDER
// ═══════════════════════════════════════════════════════════════════

class ShimmerCard extends StatelessWidget {
  const ShimmerCard({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final base = isDark ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0);
    final highlight =
        isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: base,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 56,
                height: 22,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(6),
                  color: highlight,
                ),
              ),
              const Spacer(),
              Container(
                width: 40,
                height: 16,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(4),
                  color: highlight,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            height: 12,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(4),
              color: highlight,
            ),
          ),
          const SizedBox(height: 8),
          Container(
            width: 180,
            height: 12,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(4),
              color: highlight,
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════════════

class RoutesEmptyState extends StatelessWidget {
  const RoutesEmptyState({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 60),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppTheme.primaryIndigo.withValues(alpha: 0.15),
                    AppTheme.accentEmerald.withValues(alpha: 0.15),
                  ],
                ),
                borderRadius: BorderRadius.circular(24),
              ),
              child: Icon(
                Icons.route_outlined,
                size: 40,
                color: theme.colorScheme.primary.withValues(alpha: 0.4),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'No routes assigned',
              style: GoogleFonts.inter(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: theme.textTheme.bodyLarge?.color,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'There are no routes assigned to you for this day.\nTry selecting a different date.',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                fontSize: 13,
                color: theme.textTheme.bodySmall?.color,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// ROUTE CARD
// ═══════════════════════════════════════════════════════════════════

class RouteCard extends StatefulWidget {
  const RouteCard({
    super.key,
    required this.route,
    required this.onTap,
  });

  final RouteRow route;
  final VoidCallback onTap;

  @override
  State<RouteCard> createState() => _RouteCardState();
}

class _RouteCardState extends State<RouteCard> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final typeColor = getTypeColor(widget.route.type, widget.route.typeColor);
    final supportsHover = kIsWeb || Theme.of(context).platform == TargetPlatform.macOS;

    Widget card = AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOutCubic,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      transform: _isHovered
          ? Matrix4.translationValues(0.0, -2.0, 0.0)
          : Matrix4.identity(),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: _isHovered
              ? AppTheme.primaryIndigo.withValues(alpha: 0.3)
              : (isDark ? AppTheme.dividerDark : AppTheme.dividerLight),
        ),
        boxShadow: _isHovered
            ? [
                BoxShadow(
                  color: AppTheme.primaryIndigo.withValues(alpha: 0.12),
                  blurRadius: 20,
                  offset: const Offset(0, 6),
                ),
              ]
            : (isDark ? AppTheme.softShadowDark : AppTheme.softShadow),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Row 1: Type pill + Route # ──
          Row(
            children: [
              // Type pill
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: typeColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: typeColor.withValues(alpha: 0.3),
                  ),
                ),
                child: Text(
                  widget.route.type.isNotEmpty ? widget.route.type : '—',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: typeColor,
                  ),
                ),
              ),
              const Spacer(),
              if (widget.route.routeNumber.isNotEmpty)
                Text(
                  '#${widget.route.routeNumber}',
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: theme.textTheme.bodyLarge?.color,
                  ),
                ),
            ],
          ),

          const SizedBox(height: 12),

          // ── Row 2: Info chips ──
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              if (widget.route.van.isNotEmpty) _InfoChip(
                icon: Icons.local_shipping_outlined,
                label: widget.route.van,
                theme: theme,
              ),
              if (widget.route.routeDuration.isNotEmpty) _InfoChip(
                icon: Icons.timer_outlined,
                label: widget.route.routeDuration,
                theme: theme,
              ),
              if (widget.route.waveTime.isNotEmpty) _InfoChip(
                icon: Icons.waves_outlined,
                label: widget.route.waveTime,
                theme: theme,
              ),
              if (widget.route.stopCount > 0) _InfoChip(
                icon: Icons.pin_drop_outlined,
                label: '${widget.route.stopCount} stops',
                theme: theme,
              ),
              if (widget.route.packageCount > 0) _InfoChip(
                icon: Icons.inventory_2_outlined,
                label: '${widget.route.packageCount} pkg',
                theme: theme,
              ),
            ],
          ),

          const SizedBox(height: 14),

          // ── Row 3: Status timeline ──
          Row(
            children: [
              _StatusDot(
                icon: Icons.search,
                label: 'Inspected',
                time: widget.route.inspectionTime,
                theme: theme,
              ),
              const SizedBox(width: 16),
              _StatusDot(
                icon: Icons.departure_board,
                label: 'Departed',
                time: widget.route.actualDepartureTime,
                theme: theme,
              ),
              const SizedBox(width: 16),
              _StatusDot(
                icon: Icons.check_circle_outline,
                label: 'Delivered',
                time: widget.route.deliveryCompletionTime,
                theme: theme,
              ),
            ],
          ),
        ],
      ),
    );

    if (supportsHover) {
      card = MouseRegion(
        onEnter: (_) => setState(() => _isHovered = true),
        onExit: (_) => setState(() => _isHovered = false),
        cursor: SystemMouseCursors.click,
        child: card,
      );
    }

    return GestureDetector(
      onTap: widget.onTap,
      child: card,
    );
  }
}

// ── Info Chip ──
class _InfoChip extends StatelessWidget {
  const _InfoChip({
    required this.icon,
    required this.label,
    required this.theme,
  });
  final IconData icon;
  final String label;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    final isDark = theme.brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withValues(alpha: 0.05)
            : Colors.black.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 13,
            color: theme.textTheme.bodySmall?.color,
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: theme.textTheme.bodySmall?.color,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Status Dot ──
class _StatusDot extends StatelessWidget {
  const _StatusDot({
    required this.icon,
    required this.label,
    required this.time,
    required this.theme,
  });
  final IconData icon;
  final String label;
  final String time;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    final hasValue = time.trim().isNotEmpty;
    final color = hasValue
        ? AppTheme.accentEmerald
        : (theme.textTheme.bodySmall?.color ?? Colors.grey).withValues(alpha: 0.35);

    return Expanded(
      child: Row(
        children: [
          Icon(
            hasValue ? Icons.check_circle : Icons.remove_circle_outline,
            size: 14,
            color: color,
          ),
          const SizedBox(width: 4),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.inter(
                    fontSize: 9,
                    fontWeight: FontWeight.w600,
                    color: color,
                    letterSpacing: 0.3,
                  ),
                ),
                Text(
                  hasValue ? time : '—',
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: hasValue
                        ? theme.textTheme.bodyLarge?.color
                        : color,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// ROUTE DETAIL BOTTOM SHEET
// ═══════════════════════════════════════════════════════════════════

void showRouteDetailSheet(BuildContext context, RouteRow route) {
  final theme = Theme.of(context);
  final isDark = theme.brightness == Brightness.dark;
  final typeColor = getTypeColor(route.type, route.typeColor);

  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    backgroundColor: isDark ? AppTheme.cardDark : Colors.white,
    builder: (ctx) {
      return DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.55,
        maxChildSize: 0.85,
        minChildSize: 0.3,
        builder: (_, scrollCtrl) {
          return SingleChildScrollView(
            controller: scrollCtrl,
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Drag handle
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 20),
                    decoration: BoxDecoration(
                      color: (isDark ? Colors.white : Colors.black)
                          .withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),

                // Type + route #
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: typeColor.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: typeColor.withValues(alpha: 0.3),
                        ),
                      ),
                      child: Text(
                        route.type.isNotEmpty ? route.type : 'Unknown',
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: typeColor,
                        ),
                      ),
                    ),
                    const Spacer(),
                    if (route.routeNumber.isNotEmpty)
                      Text(
                        'Route #${route.routeNumber}',
                        style: theme.textTheme.titleLarge,
                      ),
                  ],
                ),

                const SizedBox(height: 24),

                // Details grid
                _DetailRow('Van', route.van),
                _DetailRow('Duration', route.routeDuration),
                _DetailRow('Wave Time', route.waveTime),
                _DetailRow('Stops', route.stopCount > 0 ? '${route.stopCount}' : '—'),
                _DetailRow('Packages', route.packageCount > 0 ? '${route.packageCount}' : '—'),
                _DetailRow('Service Type', route.serviceType),
                _DetailRow('Attendance', route.attendance),

                const SizedBox(height: 20),

                // Timeline
                Text(
                  'Timeline',
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: theme.textTheme.bodyLarge?.color,
                  ),
                ),
                const SizedBox(height: 12),
                _TimelineEntry('Inspection', route.inspectionTime, theme),
                _TimelineEntry('Departure', route.actualDepartureTime, theme),
                _TimelineEntry('Delivery', route.deliveryCompletionTime, theme),

                const SizedBox(height: 28),

                // CTA placeholder
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    onPressed: null, // disabled
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primaryIndigo.withValues(alpha: 0.4),
                      disabledBackgroundColor:
                          AppTheme.primaryIndigo.withValues(alpha: 0.15),
                      disabledForegroundColor:
                          AppTheme.primaryIndigo.withValues(alpha: 0.4),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                      elevation: 0,
                    ),
                    child: Text(
                      'Start Inspection — Coming in next update',
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      );
    },
  );
}

class _DetailRow extends StatelessWidget {
  const _DetailRow(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    if (value.trim().isEmpty) return const SizedBox.shrink();
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: theme.textTheme.bodySmall?.color,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: GoogleFonts.inter(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: theme.textTheme.bodyLarge?.color,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TimelineEntry extends StatelessWidget {
  const _TimelineEntry(this.label, this.time, this.theme);
  final String label;
  final String time;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    final hasValue = time.trim().isNotEmpty;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Icon(
            hasValue ? Icons.check_circle : Icons.radio_button_unchecked,
            size: 18,
            color: hasValue
                ? AppTheme.accentEmerald
                : theme.textTheme.bodySmall?.color?.withValues(alpha: 0.3),
          ),
          const SizedBox(width: 12),
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: theme.textTheme.bodySmall?.color,
            ),
          ),
          const Spacer(),
          Text(
            hasValue ? time : '—',
            style: GoogleFonts.inter(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: hasValue
                  ? theme.textTheme.bodyLarge?.color
                  : theme.textTheme.bodySmall?.color?.withValues(alpha: 0.3),
            ),
          ),
        ],
      ),
    );
  }
}
