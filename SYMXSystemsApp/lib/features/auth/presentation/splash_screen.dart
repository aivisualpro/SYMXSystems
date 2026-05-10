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
        decoration: const BoxDecoration(color: Color(0xFF0A0E1A)),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // ── SYMX Logistics wordmark (full color, the same asset
              //    used by the marketing site's login page) ──
              Image.asset(
                'assets/symx-logo.png',
                width: 280,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => Text(
                  'SYMX Logistics',
                  style: GoogleFonts.inter(
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    color: isDark ? Colors.white : AppTheme.textPrimary,
                  ),
                ),
              )
                  .animate()
                  .fadeIn(duration: 600.ms)
                  .scale(
                    begin: const Offset(0.94, 0.94),
                    end: const Offset(1.0, 1.0),
                    duration: 700.ms,
                    curve: Curves.easeOutCubic,
                  ),

              const SizedBox(height: 8),

              Text(
                'DRIVER OPERATIONS',
                style: GoogleFonts.inter(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  letterSpacing: 4,
                  color: Colors.white.withValues(alpha: 0.45),
                ),
              )
                  .animate()
                  .fadeIn(delay: 450.ms, duration: 500.ms)
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
