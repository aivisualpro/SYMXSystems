import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../../auth/data/auth_repository.dart';

// ─── First-visit flag ──────────────────────────────────────────────
/// Set to `true` after login; reset to `false` once the overlay has
/// been shown.  Lives for the lifetime of the [ProviderScope].
final showWelcomeOverlayProvider = StateProvider<bool>((_) => true);

/// Full-screen welcome overlay displayed once after first login.
///
/// Shows a particle-burst effect, "Hello, {firstName} 👋" with a
/// slide-up entrance, and today's date.  Auto-dismisses after ~2.5 s
/// or on tap.
class WelcomeOverlay extends ConsumerStatefulWidget {
  const WelcomeOverlay({super.key});

  @override
  ConsumerState<WelcomeOverlay> createState() => _WelcomeOverlayState();
}

class _WelcomeOverlayState extends ConsumerState<WelcomeOverlay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _dismissCtrl;
  bool _dismissing = false;

  @override
  void initState() {
    super.initState();
    _dismissCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );

    // Auto-dismiss after 2.5 seconds.
    Future.delayed(const Duration(milliseconds: 2500), _dismiss);
  }

  void _dismiss() {
    if (_dismissing || !mounted) return;
    _dismissing = true;
    _dismissCtrl.forward().then((_) {
      if (mounted) {
        ref.read(showWelcomeOverlayProvider.notifier).state = false;
      }
    });
  }

  @override
  void dispose() {
    _dismissCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final employee = ref.watch(currentEmployeeProvider);
    final firstName = employee.whenOrNull(
          data: (e) => e?.firstName ?? 'Driver',
        ) ??
        'Driver';

    final today = DateFormat('EEEE, MMMM d, yyyy').format(DateTime.now());

    return AnimatedBuilder(
      animation: _dismissCtrl,
      builder: (context, child) {
        final t = _dismissCtrl.value;
        return Opacity(
          opacity: 1.0 - t,
          child: Transform.scale(
            scale: 1.0 + (t * 0.05),
            child: child,
          ),
        );
      },
      child: GestureDetector(
        onTap: _dismiss,
        child: Material(
          color: Colors.transparent,
          child: Container(
            width: double.infinity,
            height: double.infinity,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFF1E1B4B),
                  Color(0xFF0F172A),
                  Color(0xFF064E3B),
                ],
              ),
            ),
            child: Stack(
              children: [
                // ── Particle burst ──
                const _ParticleBurst(),

                // ── Content ──
                Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Greeting
                        Text(
                          'Hello, $firstName 👋',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.inter(
                            fontSize: 32,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                            letterSpacing: -0.5,
                          ),
                        )
                            .animate()
                            .fadeIn(duration: 500.ms)
                            .slideY(
                              begin: 0.3,
                              end: 0,
                              duration: 600.ms,
                              curve: Curves.easeOutCubic,
                            ),

                        const SizedBox(height: 12),

                        // Date
                        Text(
                          today,
                          textAlign: TextAlign.center,
                          style: GoogleFonts.inter(
                            fontSize: 15,
                            fontWeight: FontWeight.w400,
                            color: Colors.white.withValues(alpha: 0.55),
                          ),
                        )
                            .animate()
                            .fadeIn(delay: 300.ms, duration: 500.ms)
                            .slideY(
                              begin: 0.2,
                              end: 0,
                              delay: 300.ms,
                              duration: 500.ms,
                            ),

                        const SizedBox(height: 40),

                        // Subtle "tap to dismiss"
                        Text(
                          'Tap anywhere to continue',
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            color: Colors.white.withValues(alpha: 0.25),
                          ),
                        )
                            .animate()
                            .fadeIn(delay: 1200.ms, duration: 600.ms),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Particle Burst ────────────────────────────────────────────────
/// A lightweight custom-painted particle burst that replaces Lottie
/// to avoid external asset loading. Renders 40 circles that expand
/// outward from the center with randomised colours, sizes, and
/// trajectories.
class _ParticleBurst extends StatefulWidget {
  const _ParticleBurst();

  @override
  State<_ParticleBurst> createState() => _ParticleBurstState();
}

class _ParticleBurstState extends State<_ParticleBurst>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final List<_Particle> _particles;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..forward();

    final rng = Random();
    _particles = List.generate(40, (_) {
      final angle = rng.nextDouble() * 2 * pi;
      final speed = 0.3 + rng.nextDouble() * 0.7;
      final size = 4.0 + rng.nextDouble() * 8;
      final color = [
        AppTheme.primaryIndigo,
        AppTheme.accentEmerald,
        const Color(0xFF818CF8), // indigo-400
        const Color(0xFF34D399), // emerald-400
        const Color(0xFFFBBF24), // amber-400
        Colors.white,
      ][rng.nextInt(6)];
      return _Particle(angle, speed, size, color);
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (context, _) {
        return CustomPaint(
          size: Size.infinite,
          painter: _ParticlePainter(_particles, _ctrl.value),
        );
      },
    );
  }
}

class _Particle {
  _Particle(this.angle, this.speed, this.size, this.color);
  final double angle;
  final double speed;
  final double size;
  final Color color;
}

class _ParticlePainter extends CustomPainter {
  _ParticlePainter(this.particles, this.t);
  final List<_Particle> particles;
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final maxRadius = size.shortestSide * 0.6;

    for (final p in particles) {
      final distance = maxRadius * p.speed * Curves.easeOutCubic.transform(t);
      final opacity = (1.0 - t).clamp(0.0, 1.0);
      final dx = cx + cos(p.angle) * distance;
      final dy = cy + sin(p.angle) * distance;

      final paint = Paint()
        ..color = p.color.withValues(alpha: opacity * 0.7)
        ..style = PaintingStyle.fill;

      canvas.drawCircle(Offset(dx, dy), p.size * (1 - t * 0.5), paint);
    }
  }

  @override
  bool shouldRepaint(_ParticlePainter old) => old.t != t;
}
