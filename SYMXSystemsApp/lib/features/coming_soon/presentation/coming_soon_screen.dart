import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/theme/app_theme.dart';

/// "Coming Soon" screen with a centered hero, animated rocket icon,
/// parallax mouse effect on web/desktop, and a "Notify me" pill button.
class ComingSoonScreen extends StatefulWidget {
  const ComingSoonScreen({super.key});

  @override
  State<ComingSoonScreen> createState() => _ComingSoonScreenState();
}

class _ComingSoonScreenState extends State<ComingSoonScreen>
    with SingleTickerProviderStateMixin {
  // Parallax offset driven by mouse hover on web.
  double _dx = 0;
  double _dy = 0;

  // Floating animation.
  late final AnimationController _floatCtrl;

  @override
  void initState() {
    super.initState();
    _floatCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _floatCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return MouseRegion(
      onHover: (event) {
        final size = MediaQuery.of(context).size;
        setState(() {
          _dx = (event.position.dx - size.width / 2) / size.width * 12;
          _dy = (event.position.dy - size.height / 2) / size.height * 12;
        });
      },
      onExit: (_) => setState(() {
        _dx = 0;
        _dy = 0;
      }),
      child: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isDark
                ? [
                    const Color(0xFF0F172A),
                    const Color(0xFF1E1B4B).withValues(alpha: 0.6),
                    const Color(0xFF0F172A),
                  ]
                : [
                    const Color(0xFFF8FAFC),
                    const Color(0xFFEEF2FF),
                    const Color(0xFFF0FDF4),
                  ],
          ),
        ),
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // ── Animated Hero Icon ──
                AnimatedBuilder(
                  animation: _floatCtrl,
                  builder: (_, child) {
                    final float = sin(_floatCtrl.value * pi) * 8;
                    return AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      transform: Matrix4.translationValues(
                        _dx,
                        _dy + float,
                        0,
                      ),
                      child: child,
                    );
                  },
                  child: Container(
                    width: 120,
                    height: 120,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          AppTheme.primaryIndigo,
                          AppTheme.accentEmerald,
                        ],
                      ),
                      borderRadius: BorderRadius.circular(36),
                      boxShadow: [
                        BoxShadow(
                          color: AppTheme.primaryIndigo.withValues(alpha: 0.3),
                          blurRadius: 40,
                          offset: const Offset(0, 12),
                        ),
                        BoxShadow(
                          color: AppTheme.accentEmerald.withValues(alpha: 0.15),
                          blurRadius: 60,
                          offset: const Offset(0, 24),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.rocket_launch_rounded,
                      size: 56,
                      color: Colors.white,
                    ),
                  )
                      .animate()
                      .scale(
                        begin: const Offset(0.7, 0.7),
                        end: const Offset(1.0, 1.0),
                        duration: 700.ms,
                        curve: Curves.easeOutBack,
                      )
                      .fadeIn(duration: 500.ms)
                      .then()
                      .shimmer(
                        duration: 2000.ms,
                        color: Colors.white.withValues(alpha: 0.12),
                      ),
                ),

                const SizedBox(height: 36),

                // ── Headline ──
                Text(
                  'Something awesome\nis coming.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.5,
                    height: 1.3,
                    color: isDark ? Colors.white : AppTheme.textPrimary,
                  ),
                )
                    .animate()
                    .fadeIn(delay: 200.ms, duration: 500.ms)
                    .slideY(
                      begin: 0.15,
                      end: 0,
                      delay: 200.ms,
                      duration: 500.ms,
                    ),

                const SizedBox(height: 14),

                // ── Subtitle ──
                Text(
                  "We're cooking up new tools for your daily ride.",
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w400,
                    color: isDark
                        ? AppTheme.textSecondaryDark
                        : AppTheme.textSecondary,
                    height: 1.5,
                  ),
                )
                    .animate()
                    .fadeIn(delay: 400.ms, duration: 500.ms)
                    .slideY(
                      begin: 0.1,
                      end: 0,
                      delay: 400.ms,
                      duration: 500.ms,
                    ),

                const SizedBox(height: 36),

                // ── Notify me pill ──
                _NotifyMePill()
                    .animate()
                    .fadeIn(delay: 600.ms, duration: 400.ms)
                    .scale(
                      begin: const Offset(0.95, 0.95),
                      end: const Offset(1.0, 1.0),
                      delay: 600.ms,
                      duration: 400.ms,
                    ),

                const SizedBox(height: 48),

                // ── Feature preview chips ──
                const Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  alignment: WrapAlignment.center,
                  children: [
                    _FeatureChip(
                      icon: Icons.camera_alt_outlined,
                      label: 'Photo Inspections',
                    ),
                    _FeatureChip(
                      icon: Icons.gps_fixed_outlined,
                      label: 'Live Tracking',
                    ),
                    _FeatureChip(
                      icon: Icons.notifications_active_outlined,
                      label: 'Push Alerts',
                    ),
                  ],
                )
                    .animate()
                    .fadeIn(delay: 800.ms, duration: 500.ms),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// NOTIFY ME PILL
// ═══════════════════════════════════════════════════════════════════

class _NotifyMePill extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(50),
        onTap: () {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                "We'll let you know! 🎉",
                style: GoogleFonts.inter(fontWeight: FontWeight.w600),
              ),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              duration: const Duration(seconds: 2),
            ),
          );
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppTheme.primaryIndigo, AppTheme.accentEmerald],
            ),
            borderRadius: BorderRadius.circular(50),
            boxShadow: [
              BoxShadow(
                color: AppTheme.primaryIndigo.withValues(alpha: 0.3),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.notifications_none_rounded,
                size: 18,
                color: Colors.white,
              ),
              const SizedBox(width: 8),
              Text(
                'Notify me',
                style: GoogleFonts.inter(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// FEATURE CHIP
// ═══════════════════════════════════════════════════════════════════

class _FeatureChip extends StatelessWidget {
  const _FeatureChip({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withValues(alpha: 0.06)
            : Colors.black.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.08)
              : Colors.black.withValues(alpha: 0.06),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 15,
            color: theme.textTheme.bodySmall?.color,
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: theme.textTheme.bodySmall?.color,
            ),
          ),
        ],
      ),
    );
  }
}
