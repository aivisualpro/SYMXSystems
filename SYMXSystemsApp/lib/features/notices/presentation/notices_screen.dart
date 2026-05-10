// TODO: Wire to /api/mobile/notices once endpoint exists.

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lottie/lottie.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/content_constraint.dart';

// ─── Sample Data ───────────────────────────────────────────────────
class _Notice {
  const _Notice({
    required this.title,
    required this.date,
    required this.excerpt,
    required this.body,
    required this.icon,
    required this.color,
  });
  final String title;
  final String date;
  final String excerpt;
  final String body;
  final IconData icon;
  final Color color;
}

const _kSampleNotices = <_Notice>[
  _Notice(
    title: 'Updated Safety Protocols',
    date: 'May 8, 2026',
    excerpt: 'New pre-trip inspection checklist now required before departure.',
    body:
        'Effective immediately, all drivers must complete the updated 12-point '
        'pre-trip inspection checklist before leaving the station. This includes '
        'verification of tire pressure, fluid levels, and load securement. '
        'Failure to complete the checklist may result in a coaching session. '
        'Please see your dispatcher if you have questions.',
    icon: Icons.shield_outlined,
    color: Color(0xFF4F46E5),
  ),
  _Notice(
    title: 'Holiday Schedule — Memorial Day',
    date: 'May 6, 2026',
    excerpt: 'Modified dispatch schedule for the Memorial Day weekend.',
    body:
        'Operations will run on a reduced schedule from Saturday, May 24 through '
        'Monday, May 26. All routes are expected to run standard loads on '
        'Saturday. Sunday and Monday will follow the holiday matrix. Please '
        'confirm your availability with your dispatcher by Friday, May 23.',
    icon: Icons.calendar_month_outlined,
    color: Color(0xFF10B981),
  ),
  _Notice(
    title: 'New App Features Coming Soon',
    date: 'May 4, 2026',
    excerpt: 'Mobile vehicle inspections and real-time route tracking.',
    body:
        'We\'re excited to announce that the next update to the SYMX driver app '
        'will include full vehicle inspection workflows directly from your phone, '
        'real-time route tracking with ETA updates, and push notifications for '
        'schedule changes. Stay tuned for more details!',
    icon: Icons.smartphone_outlined,
    color: Color(0xFFF59E0B),
  ),
];

/// Company notices screen with expandable cards.
///
/// Displays a static list of sample notices. Each card can be tapped
/// to expand inline (using [AnimatedSize]) showing the full body.
/// Cards animate in with a staggered fade + slide.
class NoticesScreen extends StatefulWidget {
  const NoticesScreen({super.key});

  @override
  State<NoticesScreen> createState() => _NoticesScreenState();
}

class _NoticesScreenState extends State<NoticesScreen> {
  final Set<int> _expandedIndices = {};

  void _toggle(int index) {
    setState(() {
      if (_expandedIndices.contains(index)) {
        _expandedIndices.remove(index);
      } else {
        _expandedIndices.add(index);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    const notices = _kSampleNotices;

    if (notices.isEmpty) {
      return const _EmptyNotices();
    }

    return ContentConstraint(
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        itemCount: notices.length,
        itemBuilder: (_, i) {
          return _NoticeCard(
            notice: notices[i],
            isExpanded: _expandedIndices.contains(i),
            onTap: () => _toggle(i),
          ).animate().fadeIn(duration: 250.ms, delay: (i * 60).ms).slideY(
                begin: 0.06,
                end: 0,
                duration: 300.ms,
                delay: (i * 60).ms,
                curve: Curves.easeOutCubic,
              );
        },
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// NOTICE CARD
// ═══════════════════════════════════════════════════════════════════

class _NoticeCard extends StatelessWidget {
  const _NoticeCard({
    required this.notice,
    required this.isExpanded,
    required this.onTap,
  });

  final _Notice notice;
  final bool isExpanded;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOutCubic,
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? AppTheme.cardDark : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isExpanded
                ? notice.color.withValues(alpha: 0.35)
                : (isDark ? AppTheme.dividerDark : AppTheme.dividerLight),
          ),
          boxShadow: isExpanded
              ? [
                  BoxShadow(
                    color: notice.color.withValues(alpha: 0.08),
                    blurRadius: 20,
                    offset: const Offset(0, 4),
                  ),
                ]
              : (isDark ? AppTheme.softShadowDark : AppTheme.softShadow),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Header Row ──
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Icon circle
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: notice.color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(notice.icon, size: 20, color: notice.color),
                ),
                const SizedBox(width: 12),
                // Title + date
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        notice.title,
                        style: GoogleFonts.inter(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: theme.textTheme.bodyLarge?.color,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        notice.date,
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: theme.textTheme.bodySmall?.color,
                        ),
                      ),
                    ],
                  ),
                ),
                // Chevron
                AnimatedRotation(
                  turns: isExpanded ? 0.5 : 0,
                  duration: const Duration(milliseconds: 200),
                  child: Icon(
                    Icons.keyboard_arrow_down_rounded,
                    size: 22,
                    color: theme.textTheme.bodySmall?.color,
                  ),
                ),
              ],
            ),

            const SizedBox(height: 10),

            // ── Excerpt ──
            Text(
              notice.excerpt,
              style: GoogleFonts.inter(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: theme.textTheme.bodySmall?.color,
                height: 1.5,
              ),
            ),

            // ── Expanded Body ──
            AnimatedSize(
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeOutCubic,
              alignment: Alignment.topCenter,
              child: isExpanded
                  ? Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: double.infinity,
                            height: 1,
                            color: isDark
                                ? AppTheme.dividerDark
                                : AppTheme.dividerLight,
                          ),
                          const SizedBox(height: 12),
                          Text(
                            notice.body,
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              fontWeight: FontWeight.w400,
                              color: theme.textTheme.bodyLarge?.color,
                              height: 1.65,
                            ),
                          ),
                        ],
                      ),
                    )
                  : const SizedBox.shrink(),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════════════

class _EmptyNotices extends StatelessWidget {
  const _EmptyNotices();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(48),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Lottie.asset(
              'assets/lottie/empty_box.json',
              width: 180,
              height: 180,
              repeat: true,
              fit: BoxFit.contain,
            ),
            const SizedBox(height: 20),
            Text(
              'No notices yet',
              style: GoogleFonts.inter(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: theme.textTheme.bodyLarge?.color,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Company announcements will appear here\nwhen they are posted.',
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
