import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../home/presentation/welcome_overlay.dart';
import '../data/auth_repository.dart';
import 'login_widgets.dart';

// ─── State ─────────────────────────────────────────────────────────
final _loginLoadingProvider = StateProvider<bool>((_) => false);
final _loginErrorProvider = StateProvider<String?>((_) => null);

/// Login screen that matches the look and feel of the existing
/// SYMX Logistics web login (see app/login/page.tsx) — scenic
/// background, rising blue particles, full-color wordmark, dark blue
/// gradient card with the original blue Sign In button.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _pinController = TextEditingController();
  final _pinFocusNode = FocusNode();

  @override
  void dispose() {
    _pinController.dispose();
    _pinFocusNode.dispose();
    super.dispose();
  }

  Future<void> _handleLogin([String? _]) async {
    final pin = _pinController.text.trim();
    if (pin.length < 4) return;

    ref.read(_loginErrorProvider.notifier).state = null;
    ref.read(_loginLoadingProvider.notifier).state = true;

    try {
      await ref.read(authRepositoryProvider).login(pin);
      HapticFeedback.mediumImpact();

      if (mounted) {
        ref.invalidate(currentEmployeeProvider);
        ref.read(showWelcomeOverlayProvider.notifier).state = true;
        context.go('/home');
      }
    } catch (e) {
      String msg = 'Invalid badge number. Please try again.';
      if (e is DioException && e.response?.data != null) {
        final serverMsg = e.response?.data['error'];
        if (serverMsg != null) msg = serverMsg.toString();
      } else if (e is DioException) {
        msg = 'Network error — check your connection.';
      }
      ref.read(_loginErrorProvider.notifier).state = msg;
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

    return Scaffold(
      backgroundColor: LoginBrand.base,
      resizeToAvoidBottomInset: true,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // ── Scenic background image with slow zoom + dark blue overlay ──
          const LoginScenicBg(),

          // ── Rising blue particles ──
          const LoginParticles(),

          // ── Foreground content ──
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // ── Logo + heading section ──
                      const LoginWordmark()
                          .animate()
                          .fadeIn(duration: 1200.ms)
                          .slideX(
                            begin: -0.05,
                            end: 0,
                            duration: 1200.ms,
                            curve: Curves.easeOutCubic,
                          ),

                      const SizedBox(height: 24),

                      const LoginHeading(
                        title: 'Welcome Back',
                        subtitle: 'Sign in to your account to continue',
                      )
                          .animate()
                          .fadeIn(delay: 500.ms, duration: 800.ms),

                      const SizedBox(height: 40),

                      // ── Card ──
                      LoginCard(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const LoginFieldLabel(text: 'Badge PIN'),
                            const SizedBox(height: 4),
                            // PIN input + button both react to controller
                            // changes via ListenableBuilder so the CTA
                            // enables the moment the 4th digit is entered.
                            ListenableBuilder(
                              listenable: _pinController,
                              builder: (context, _) {
                                final filled =
                                    _pinController.text.length >= 4;
                                return Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    LoginPinInput(
                                      controller: _pinController,
                                      focusNode: _pinFocusNode,
                                      enabled: true,
                                      onCompleted: _handleLogin,
                                    ),
                                    const SizedBox(height: 16),
                                    if (error != null)
                                      LoginErrorChip(message: error)
                                          .animate()
                                          .shakeX(
                                            hz: 4,
                                            amount: 4,
                                            duration: 400.ms,
                                          )
                                          .fadeIn(duration: 200.ms),
                                    const SizedBox(height: 20),
                                    LoginPrimaryButton(
                                      onPressed: (isLoading || !filled)
                                          ? null
                                          : _handleLogin,
                                      loading: isLoading,
                                      label: 'Sign In',
                                    ),
                                  ],
                                );
                              },
                            ),
                          ],
                        ),
                      )
                          .animate()
                          .fadeIn(delay: 400.ms, duration: 700.ms)
                          .slideY(
                            begin: 0.06,
                            end: 0,
                            delay: 400.ms,
                            duration: 700.ms,
                            curve: Curves.easeOutCubic,
                          ),
                    ],
                  ),
                ),
              ),
            ),
          ),

          // ── Footer ──
          Positioned(
            left: 0,
            right: 0,
            bottom: 24,
            child: Center(
              child: Text(
                '© ${DateTime.now().year} SYMX SYSTEMS. ALL RIGHTS RESERVED.',
                style: GoogleFonts.inter(
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                  letterSpacing: 2,
                  color: Colors.white.withValues(alpha: 0.5),
                ),
              ).animate().fadeIn(delay: 1000.ms, duration: 800.ms),
            ),
          ),
        ],
      ),
    );
  }
}
