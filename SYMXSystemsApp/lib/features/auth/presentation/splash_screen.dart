import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/theme/app_theme.dart';
import '../../home/presentation/welcome_overlay.dart';
import '../data/auth_repository.dart';

/// Animated splash screen displayed on app launch.
///
/// Shows a branded SYMX logo with scale + fade + shimmer animations,
/// then checks for an existing session. Routes to `/home` (if valid
/// token) or `/login` (otherwise) after a minimum 900 ms hold.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _checkAuthAndNavigate();
  }

  Future<void> _checkAuthAndNavigate() async {
    final repo = ref.read(authRepositoryProvider);

    // Run token+cache check and minimum hold in parallel.
    final results = await Future.wait([
      _resolveEmployee(repo),
      Future.delayed(const Duration(milliseconds: 900)),
    ]);

    if (!mounted) return;

    final employee = results[0] as Employee?;
    if (employee != null) {
      // Returning user — skip the welcome overlay.
      ref.read(showWelcomeOverlayProvider.notifier).state = false;
      context.go('/home');
      // Background refresh — don't await.
      _backgroundRefresh(repo);
    } else {
      context.go('/login');
    }
  }

  /// Try cached employee first, fall back to network only if cache misses.
  Future<Employee?> _resolveEmployee(AuthRepository repo) async {
    if (!await repo.hasToken) return null;
    final cached = await repo.cachedEmployee();
    if (cached != null) return cached;
    try {
      return await repo.me();
    } catch (_) {
      return null;
    }
  }

  /// Silently refresh the employee profile in the background.
  /// If the token is expired/invalid, clear auth state so the user
  /// is bounced to /login on the next interaction.
  Future<void> _backgroundRefresh(AuthRepository repo) async {
    try {
      await repo.me();
      ref.invalidate(currentEmployeeProvider);
    } catch (_) {
      await repo.logout();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isDark
                ? [
                    const Color(0xFF0F172A),
                    const Color(0xFF1E1B4B),
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
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // ── Logo Icon ──
              Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      AppTheme.primaryIndigo,
                      AppTheme.accentEmerald,
                    ],
                  ),
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(
                      color: AppTheme.primaryIndigo.withValues(alpha: 0.35),
                      blurRadius: 32,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.local_shipping_rounded,
                  size: 44,
                  color: Colors.white,
                ),
              )
                  .animate()
                  .scale(
                    begin: const Offset(0.6, 0.6),
                    end: const Offset(1.0, 1.0),
                    duration: 600.ms,
                    curve: Curves.easeOutBack,
                  )
                  .fadeIn(duration: 400.ms)
                  .then()
                  .shimmer(
                    duration: 1800.ms,
                    color: Colors.white.withValues(alpha: 0.15),
                  ),

              const SizedBox(height: 28),

              // ── Brand Text ──
              Text(
                'SYMX',
                style: GoogleFonts.inter(
                  fontSize: 36,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 6,
                  color: isDark ? Colors.white : AppTheme.textPrimary,
                ),
              )
                  .animate()
                  .fadeIn(delay: 200.ms, duration: 500.ms)
                  .slideY(begin: 0.15, end: 0, duration: 500.ms),

              const SizedBox(height: 6),

              Text(
                'SYSTEMS',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  letterSpacing: 8,
                  color: isDark
                      ? AppTheme.textSecondaryDark
                      : AppTheme.textSecondary,
                ),
              )
                  .animate()
                  .fadeIn(delay: 400.ms, duration: 500.ms)
                  .slideY(begin: 0.15, end: 0, duration: 500.ms),

              const SizedBox(height: 48),

              // ── Loading indicator ──
              SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    AppTheme.primaryIndigo.withValues(alpha: 0.6),
                  ),
                ),
              ).animate().fadeIn(delay: 600.ms, duration: 400.ms),
            ],
          ),
        ),
      ),
    );
  }
}
