import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/theme/app_theme.dart';
import '../../home/presentation/welcome_overlay.dart';
import '../data/auth_repository.dart';
import 'login_widgets.dart';

// ─── State Providers ───────────────────────────────────────────────
final _loginLoadingProvider = StateProvider<bool>((_) => false);
final _loginErrorProvider = StateProvider<String?>((_) => null);

/// Full-screen login with animated gradient background, a glassy
/// center card containing a 4-digit PIN input, and polished
/// micro-animations throughout.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _pinController = TextEditingController();
  final _pinFocusNode = FocusNode();

  // Gradient animation state.
  bool _gradientFlip = false;

  @override
  void initState() {
    super.initState();
    _startGradientCycle();
  }

  void _startGradientCycle() {
    Future.delayed(const Duration(milliseconds: 300), () {
      if (mounted) setState(() => _gradientFlip = true);
    });
    Future.doWhile(() async {
      await Future.delayed(const Duration(seconds: 6));
      if (!mounted) return false;
      setState(() => _gradientFlip = !_gradientFlip);
      return true;
    });
  }

  @override
  void dispose() {
    _pinController.dispose();
    _pinFocusNode.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    final pin = _pinController.text.trim();
    if (pin.length < 4) return;

    ref.read(_loginErrorProvider.notifier).state = null;
    ref.read(_loginLoadingProvider.notifier).state = true;

    try {
      await ref.read(authRepositoryProvider).login(pin);

      // Haptic feedback on success.
      HapticFeedback.mediumImpact();

      if (mounted) {
        // Invalidate current employee so it re-fetches on home.
        ref.invalidate(currentEmployeeProvider);
        // Ensure welcome overlay appears for this fresh login.
        ref.read(showWelcomeOverlayProvider.notifier).state = true;
        context.go('/home');
      }
    } catch (e) {
      ref.read(_loginErrorProvider.notifier).state =
          'Invalid badge number. Please try again.';
      _pinController.clear();
      _pinFocusNode.requestFocus();
    } finally {
      if (mounted) {
        ref.read(_loginLoadingProvider.notifier).state = false;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(_loginLoadingProvider);
    final error = ref.watch(_loginErrorProvider);
    final screenWidth = MediaQuery.of(context).size.width;
    final isWide = screenWidth > 600;

    return Scaffold(
      resizeToAvoidBottomInset: true,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // ── Animated Gradient Background ──
          LoginGradientBg(flip: _gradientFlip),

          // ── Content ──
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: isWide ? 420 : double.infinity,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const SizedBox(height: 24),

                      // ── Wordmark ──
                      const LoginWordmark()
                          .animate()
                          .fadeIn(duration: 600.ms)
                          .slideY(
                            begin: -0.2,
                            end: 0,
                            duration: 600.ms,
                            curve: Curves.easeOutCubic,
                          ),

                      const SizedBox(height: 40),

                      // ── Glass Card ──
                      LoginGlassCard(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'Welcome, Driver',
                              style: GoogleFonts.inter(
                                fontSize: 22,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Enter your Badge PIN to continue',
                              style: GoogleFonts.inter(
                                fontSize: 14,
                                color: Colors.white.withValues(alpha: 0.65),
                              ),
                            ),

                            const SizedBox(height: 32),

                            // ── PIN Input ──
                            LoginPinInput(
                              controller: _pinController,
                              focusNode: _pinFocusNode,
                              enabled: !isLoading,
                              onCompleted: (_) => _handleLogin(),
                            ),

                            const SizedBox(height: 8),

                            // ── Error Chip ──
                            if (error != null)
                              LoginErrorChip(message: error)
                                  .animate()
                                  .shakeX(
                                    hz: 4,
                                    amount: 4,
                                    duration: 400.ms,
                                  )
                                  .fadeIn(duration: 200.ms),

                            const SizedBox(height: 24),

                            // ── Sign In Button ──
                            SizedBox(
                              width: double.infinity,
                              height: 52,
                              child: ElevatedButton(
                                onPressed: isLoading ? null : _handleLogin,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppTheme.primaryIndigo,
                                  foregroundColor: Colors.white,
                                  disabledBackgroundColor:
                                      AppTheme.primaryIndigo.withValues(alpha: 0.5),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                  elevation: 0,
                                ),
                                child: isLoading
                                    ? const SizedBox(
                                        width: 22,
                                        height: 22,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2.5,
                                          valueColor:
                                              AlwaysStoppedAnimation<Color>(
                                            Colors.white,
                                          ),
                                        ),
                                      )
                                    : Text(
                                        'Sign In',
                                        style: GoogleFonts.inter(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                              ),
                            ),
                          ],
                        ),
                      )
                          .animate()
                          .fadeIn(delay: 200.ms, duration: 500.ms)
                          .slideY(
                            begin: 0.08,
                            end: 0,
                            delay: 200.ms,
                            duration: 500.ms,
                            curve: Curves.easeOutCubic,
                          ),

                      const SizedBox(height: 48),

                      // ── Footer ──
                      Text(
                        'v1.0 • SYMX Systems',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: Colors.white.withValues(alpha: 0.35),
                        ),
                      ).animate().fadeIn(delay: 600.ms, duration: 500.ms),

                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
