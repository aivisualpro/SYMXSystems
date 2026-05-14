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
final _loginErrorProvider   = StateProvider<String?>((_) => null);

/// Login screen — single card with two input options on the same view:
///   • Badge PIN  (4-digit badgeNumber)       — top
///   • ── or ──                               — divider
///   • Email      (SYMXEmployees.email)       — bottom
///
/// Whichever field is non-empty when Sign In is tapped is used.
/// If both are filled, PIN takes priority.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _pinController   = TextEditingController();
  final _pinFocusNode    = FocusNode();
  final _emailController = TextEditingController();
  final _emailFocusNode  = FocusNode();

  @override
  void dispose() {
    _pinController.dispose();
    _pinFocusNode.dispose();
    _emailController.dispose();
    _emailFocusNode.dispose();
    super.dispose();
  }

  // ── Decide which method to use based on what the user filled ─────
  Future<void> _handleLogin([String? _]) async {
    final pin   = _pinController.text.trim();
    final email = _emailController.text.trim();

    // Need at least one filled
    if (pin.isEmpty && email.isEmpty) return;

    // PIN takes priority if filled
    if (pin.isNotEmpty && pin.length < 4) return;

    ref.read(_loginErrorProvider.notifier).state = null;
    ref.read(_loginLoadingProvider.notifier).state = true;

    try {
      if (pin.isNotEmpty) {
        await ref.read(authRepositoryProvider).login(pin);
      } else {
        await ref.read(authRepositoryProvider).loginWithEmail(email);
      }

      HapticFeedback.mediumImpact();
      if (mounted) {
        ref.invalidate(currentEmployeeProvider);
        ref.read(showWelcomeOverlayProvider.notifier).state = true;
        context.go('/home');
      }
    } catch (e) {
      String msg = pin.isNotEmpty
          ? 'Invalid badge number. Please try again.'
          : 'No active employee found with that email.';
      if (e is DioException && e.response?.data != null) {
        final serverMsg = e.response?.data['error'];
        if (serverMsg != null) msg = serverMsg.toString();
      } else if (e is DioException) {
        msg = 'Network error — check your connection.';
      }
      ref.read(_loginErrorProvider.notifier).state = msg;
      if (pin.isNotEmpty) {
        _pinController.clear();
        _pinFocusNode.requestFocus();
      }
    } finally {
      if (mounted) ref.read(_loginLoadingProvider.notifier).state = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(_loginLoadingProvider);
    final error     = ref.watch(_loginErrorProvider);

    return Scaffold(
      backgroundColor: LoginBrand.base,
      resizeToAvoidBottomInset: true,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // ── Scenic background + overlay ──
          const LoginScenicBg(),
          const LoginParticles(),

          // ── Foreground ──
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // ── Logo ──
                      const LoginWordmark()
                          .animate()
                          .fadeIn(duration: 1200.ms)
                          .slideX(begin: -0.05, end: 0, duration: 1200.ms, curve: Curves.easeOutCubic),

                      const SizedBox(height: 24),

                      const LoginHeading(
                        title: 'Welcome Back',
                        subtitle: 'Sign in to your account to continue',
                      ).animate().fadeIn(delay: 500.ms, duration: 800.ms),

                      const SizedBox(height: 40),

                      // ── Card ──
                      LoginCard(
                        child: ListenableBuilder(
                          listenable: Listenable.merge([_pinController, _emailController]),
                          builder: (context, _) {
                            final pinFilled   = _pinController.text.length >= 4;
                            final emailFilled = _emailController.text.trim().isNotEmpty;
                            final canSubmit   = pinFilled || emailFilled;

                            return Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [

                                // ── Badge PIN field ──────────────────
                                const LoginFieldLabel(text: 'Badge PIN'),
                                const SizedBox(height: 4),
                                LoginPinInput(
                                  controller: _pinController,
                                  focusNode: _pinFocusNode,
                                  enabled: !isLoading,
                                  onCompleted: _handleLogin,
                                ),

                                const SizedBox(height: 24),

                                // ── "or" divider ─────────────────────
                                Row(
                                  children: [
                                    Expanded(
                                      child: Container(
                                        height: 1,
                                        decoration: BoxDecoration(
                                          gradient: LinearGradient(colors: [
                                            Colors.transparent,
                                            Colors.white.withValues(alpha: 0.15),
                                          ]),
                                        ),
                                      ),
                                    ),
                                    Padding(
                                      padding: const EdgeInsets.symmetric(horizontal: 14),
                                      child: Text(
                                        'or',
                                        style: GoogleFonts.inter(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w400,
                                          letterSpacing: 0.5,
                                          color: Colors.white.withValues(alpha: 0.35),
                                        ),
                                      ),
                                    ),
                                    Expanded(
                                      child: Container(
                                        height: 1,
                                        decoration: BoxDecoration(
                                          gradient: LinearGradient(colors: [
                                            Colors.white.withValues(alpha: 0.15),
                                            Colors.transparent,
                                          ]),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),

                                const SizedBox(height: 24),

                                // ── Email field ───────────────────────
                                const LoginFieldLabel(text: 'Email'),
                                const SizedBox(height: 4),
                                LoginEmailInput(
                                  controller: _emailController,
                                  focusNode: _emailFocusNode,
                                  enabled: !isLoading,
                                  onSubmitted: _handleLogin,
                                ),

                                const SizedBox(height: 20),

                                // ── Error chip ───────────────────────
                                if (error != null)
                                  LoginErrorChip(message: error)
                                      .animate()
                                      .shakeX(hz: 4, amount: 4, duration: 400.ms)
                                      .fadeIn(duration: 200.ms),
                                if (error != null) const SizedBox(height: 16),

                                // ── Sign In button ────────────────────
                                LoginPrimaryButton(
                                  onPressed: (isLoading || !canSubmit) ? null : _handleLogin,
                                  loading: isLoading,
                                  label: 'Sign In',
                                ),
                              ],
                            );
                          },
                        ),
                      )
                          .animate()
                          .fadeIn(delay: 400.ms, duration: 700.ms)
                          .slideY(begin: 0.06, end: 0, delay: 400.ms, duration: 700.ms, curve: Curves.easeOutCubic),
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
