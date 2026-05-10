import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

// ═══════════════════════════════════════════════════════════════════
// LOGIN BRAND PALETTE — matches the original Next.js login exactly
// ═══════════════════════════════════════════════════════════════════

class LoginBrand {
  LoginBrand._();
  static const Color base = Color(0xFF0A0E1A);
  static const Color blue600 = Color(0xFF2563EB);
  static const Color blue700 = Color(0xFF1D4ED8);
  static const Color blue500 = Color(0xFF3B82F6);
  static const Color zinc400 = Color(0xFFA1A1AA);
  static const Color zinc300 = Color(0xFFD4D4D8);

  // Card gradient
  static const Color cardTop = Color(0xE60C1734);    // rgba(5,12,30,0.85) ish
  static const Color cardBottom = Color(0xE6081A36); // rgba(8,18,45,0.9)
  static const Color cardBorder = Color(0x1A64A0FF); // rgba(100,160,255,0.1)

  // Background overlay
  static const Color overlayA = Color(0xBF020612); // rgba(2,6,18,0.75)
  static const Color overlayB = Color(0x990F2A4F); // rgba(15,42,79,0.6)
  static const Color overlayC = Color(0xB30A1432); // rgba(10,20,50,0.7)
}

// ═══════════════════════════════════════════════════════════════════
// SCENIC BACKGROUND — login-bg.jpg with slow zoom + dark blue overlay
// ═══════════════════════════════════════════════════════════════════

class LoginScenicBg extends StatefulWidget {
  const LoginScenicBg({super.key});

  @override
  State<LoginScenicBg> createState() => _LoginScenicBgState();
}

class _LoginScenicBgState extends State<LoginScenicBg>
    with SingleTickerProviderStateMixin {
  late final AnimationController _zoomCtrl;

  @override
  void initState() {
    super.initState();
    _zoomCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 30),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _zoomCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        // Solid base
        Container(color: LoginBrand.base),

        // Slow-zooming background image
        AnimatedBuilder(
          animation: _zoomCtrl,
          builder: (_, __) {
            final scale = 1.0 + 0.08 * _zoomCtrl.value;
            return Transform.scale(
              scale: scale,
              child: Image.asset(
                'assets/login-bg.jpg',
                fit: BoxFit.cover,
                width: double.infinity,
                height: double.infinity,
                errorBuilder: (_, __, ___) => Container(color: LoginBrand.base),
              ),
            );
          },
        ),

        // Dark blue overlay (matches the .login-bg-overlay gradient)
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              stops: [0.0, 0.4, 1.0],
              colors: [
                LoginBrand.overlayA,
                LoginBrand.overlayB,
                LoginBrand.overlayC,
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// RISING BLUE PARTICLES — 15 of them, drifting from bottom up
// ═══════════════════════════════════════════════════════════════════

class LoginParticles extends StatefulWidget {
  const LoginParticles({super.key});

  @override
  State<LoginParticles> createState() => _LoginParticlesState();
}

class _LoginParticlesState extends State<LoginParticles>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final List<_Particle> _particles;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 12),
    )..repeat();
    final rng = math.Random(11);
    _particles = List.generate(15, (i) {
      return _Particle(
        x: ((i * 7.3 + 5) % 100) / 100.0,
        size: 2 + (i * 0.37) % 3,
        opacity: 0.10 + ((i * 0.13) % 0.20),
        delay: ((i * 0.53) % 8) / 14.0,
        speed: 1.0 / (6 + (i * 0.87) % 8) * 14.0,
        wiggle: rng.nextDouble() * 30 + 10,
        seed: rng.nextDouble() * math.pi * 2,
      );
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: AnimatedBuilder(
        animation: _ctrl,
        builder: (_, __) {
          return CustomPaint(
            painter: _ParticlePainter(
              particles: _particles,
              t: _ctrl.value,
            ),
            size: Size.infinite,
          );
        },
      ),
    );
  }
}

class _Particle {
  _Particle({
    required this.x,
    required this.size,
    required this.opacity,
    required this.delay,
    required this.speed,
    required this.wiggle,
    required this.seed,
  });
  final double x, size, opacity, delay, speed, wiggle, seed;
}

class _ParticlePainter extends CustomPainter {
  _ParticlePainter({required this.particles, required this.t});
  final List<_Particle> particles;
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    for (final p in particles) {
      // 0..1 progress through this particle's full rise
      final progress = ((t * p.speed) + p.delay) % 1.0;
      // Vertical position: bottom (1.0) → top (-0.05)
      final y = (1.0 - progress) * size.height;
      // Subtle horizontal wiggle
      final dx = math.sin(progress * math.pi * 2 + p.seed) * p.wiggle;
      final x = p.x * size.width + dx;

      // Fade in for first 10%, full opacity, fade slightly after 90%
      double opacityFactor;
      if (progress < 0.1) {
        opacityFactor = progress / 0.1;
      } else if (progress > 0.9) {
        opacityFactor = (1.0 - progress) / 0.1 * 0.3;
      } else {
        opacityFactor = 1.0;
      }

      canvas.drawCircle(
        Offset(x, y),
        p.size,
        Paint()
          ..color =
              const Color(0xFF78B4FF).withValues(alpha: p.opacity * opacityFactor),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _ParticlePainter old) => old.t != t;
}

// ═══════════════════════════════════════════════════════════════════
// SYMX WORDMARK — full color (NO white blend), with shimmer
// ═══════════════════════════════════════════════════════════════════

class LoginWordmark extends StatefulWidget {
  const LoginWordmark({super.key});

  @override
  State<LoginWordmark> createState() => _LoginWordmarkState();
}

class _LoginWordmarkState extends State<LoginWordmark>
    with SingleTickerProviderStateMixin {
  late final AnimationController _shimmerCtrl;

  @override
  void initState() {
    super.initState();
    _shimmerCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    );
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) _shimmerCtrl.repeat();
    });
  }

  @override
  void dispose() {
    _shimmerCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ShaderMask(
      shaderCallback: (bounds) {
        // Subtle drop-shadow-like glow handled by box decorations elsewhere.
        return const LinearGradient(
          colors: [Colors.white, Colors.white],
        ).createShader(bounds);
      },
      blendMode: BlendMode.dstIn,
      child: Stack(
        clipBehavior: Clip.hardEdge,
        children: [
          // Logo in FULL color, with a soft white drop shadow
          Container(
            decoration: BoxDecoration(
              boxShadow: [
                BoxShadow(
                  color: Colors.white.withValues(alpha: 0.20),
                  blurRadius: 15,
                  spreadRadius: 0,
                ),
              ],
            ),
            child: Image.asset(
              'assets/symx-logo.png',
              width: 280,
              fit: BoxFit.contain,
              // NO color blend — show the original colors of the wordmark.
              errorBuilder: (_, __, ___) => Text(
                'SYMX Logistics',
                style: GoogleFonts.inter(
                  fontSize: 32,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
            ),
          ),

          // Shimmer sheen sweep (every 4s, after a 2s delay)
          Positioned.fill(
            child: AnimatedBuilder(
              animation: _shimmerCtrl,
              builder: (_, __) {
                final v = _shimmerCtrl.value;
                final dx = -1.5 + v * 3.0; // -1.5 → 1.5
                return ClipRect(
                  child: Transform.translate(
                    offset: Offset(dx * 280, 0),
                    child: Transform(
                      transform: Matrix4.skewX(-0.45),
                      child: Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              Colors.transparent,
                              Colors.white.withValues(
                                  alpha: v < 0.2 || v > 0.4 ? 0 : 0.20),
                              Colors.transparent,
                            ],
                            stops: const [0.4, 0.5, 0.6],
                          ),
                        ),
                      ),
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

// ═══════════════════════════════════════════════════════════════════
// "WELCOME BACK" HEADING — uppercase, tracked, with thin blue divider
// ═══════════════════════════════════════════════════════════════════

class LoginHeading extends StatelessWidget {
  const LoginHeading({super.key, required this.title, required this.subtitle});
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Thin gradient divider line (transparent → blue → transparent)
        Container(
          width: 96,
          height: 1,
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [
                Colors.transparent,
                LoginBrand.blue500,
                Colors.transparent,
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),
        Text(
          title.toUpperCase(),
          textAlign: TextAlign.center,
          style: GoogleFonts.inter(
            fontSize: 20,
            fontWeight: FontWeight.w500,
            letterSpacing: 4,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          subtitle.toUpperCase(),
          textAlign: TextAlign.center,
          style: GoogleFonts.inter(
            fontSize: 11,
            fontWeight: FontWeight.w300,
            letterSpacing: 3.6,
            color: LoginBrand.zinc400,
          ),
        ),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// CARD — dark blue gradient with subtle blue border + glow
// ═══════════════════════════════════════════════════════════════════

class LoginCard extends StatelessWidget {
  const LoginCard({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [LoginBrand.cardTop, LoginBrand.cardBottom],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: LoginBrand.cardBorder, width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.6),
            blurRadius: 60,
            offset: const Offset(0, 25),
          ),
          BoxShadow(
            color: LoginBrand.blue600.withValues(alpha: 0.15),
            blurRadius: 100,
            offset: const Offset(0, 0),
          ),
        ],
      ),
      child: child,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// LABEL — uppercase, tracked, ml-1
// ═══════════════════════════════════════════════════════════════════

class LoginFieldLabel extends StatelessWidget {
  const LoginFieldLabel({super.key, required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        text.toUpperCase(),
        style: GoogleFonts.inter(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          letterSpacing: 1.65,
          color: Colors.white,
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// PIN INPUT — 4 cells styled like the original blue-focused inputs
// ═══════════════════════════════════════════════════════════════════

class LoginPinInput extends StatefulWidget {
  const LoginPinInput({
    super.key,
    required this.controller,
    required this.focusNode,
    required this.enabled,
    required this.onCompleted,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final bool enabled;
  final ValueChanged<String> onCompleted;

  @override
  State<LoginPinInput> createState() => _LoginPinInputState();
}

class _LoginPinInputState extends State<LoginPinInput> {
  static const int _length = 4;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onChanged);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onChanged);
    super.dispose();
  }

  void _onChanged() {
    final text = widget.controller.text;
    setState(() {});
    if (text.length == _length) {
      // Let the 4th dot finish its scale/glow animation before submit.
      Future.delayed(const Duration(milliseconds: 220), () {
        if (mounted && widget.controller.text.length == _length) {
          widget.onCompleted(text);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final pin = widget.controller.text;

    return Stack(
      alignment: Alignment.center,
      children: [
        LayoutBuilder(
          builder: (context, constraints) {
            final screenW = MediaQuery.of(context).size.width;
            final maxW = (constraints.hasBoundedWidth
                    ? constraints.maxWidth
                    : screenW - 96)
                .clamp(160.0, 480.0);

            final gap = maxW < 240 ? 4.0 : 8.0;

            return ConstrainedBox(
              constraints: BoxConstraints(maxWidth: maxW),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(_length * 2 - 1, (index) {
                  // Odd indices are spacers between cells.
                  if (index.isOdd) return SizedBox(width: gap);

                  final i = index ~/ 2;
                  final filled = i < pin.length;
                  final active = i == pin.length;
                  return Flexible(
                    child: AspectRatio(
                      aspectRatio: 1 / 1.07,
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        curve: Curves.easeOutCubic,
                        constraints: const BoxConstraints(
                          maxWidth: 64,
                          maxHeight: 68,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(
                              alpha: filled ? 0.07 : 0.04),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: active
                                ? LoginBrand.blue500.withValues(alpha: 0.7)
                                : filled
                                    ? LoginBrand.blue500
                                        .withValues(alpha: 0.45)
                                    : Colors.white.withValues(alpha: 0.1),
                            width: active ? 1.5 : 1,
                          ),
                          boxShadow: active
                              ? [
                                  BoxShadow(
                                    color: LoginBrand.blue500
                                        .withValues(alpha: 0.20),
                                    blurRadius: 20,
                                    spreadRadius: 0,
                                  ),
                                ]
                              : null,
                        ),
                        alignment: Alignment.center,
                        child: AnimatedScale(
                          scale: filled ? 1 : 0,
                          duration: const Duration(milliseconds: 180),
                          curve: Curves.easeOutBack,
                          child: Container(
                            width: 12,
                            height: 12,
                            decoration: const BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                }),
              ),
            );
          },
        ),
        Opacity(
          opacity: 0,
          child: SizedBox(
            width: 1,
            height: 1,
            child: TextField(
              controller: widget.controller,
              focusNode: widget.focusNode,
              autofocus: true,
              enabled: widget.enabled,
              keyboardType: TextInputType.number,
              maxLength: _length,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(_length),
              ],
              onChanged: (_) => HapticFeedback.selectionClick(),
              decoration: const InputDecoration(
                counterText: '',
                border: InputBorder.none,
              ),
            ),
          ),
        ),
        Positioned.fill(
          child: GestureDetector(
            behavior: HitTestBehavior.translucent,
            onTap: () => widget.focusNode.requestFocus(),
          ),
        ),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// ERROR CHIP
// ═══════════════════════════════════════════════════════════════════

class LoginErrorChip extends StatelessWidget {
  const LoginErrorChip({super.key, required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFEF4444).withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: const Color(0xFFEF4444).withValues(alpha: 0.30),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline_rounded,
              size: 16, color: Color(0xFFFCA5A5)),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              message,
              style: GoogleFonts.inter(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: const Color(0xFFFCA5A5),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// PRIMARY BUTTON — exact copy of the original .login-button (blue gradient)
// ═══════════════════════════════════════════════════════════════════

class LoginPrimaryButton extends StatefulWidget {
  const LoginPrimaryButton({
    super.key,
    required this.onPressed,
    required this.loading,
    required this.label,
  });

  final VoidCallback? onPressed;
  final bool loading;
  final String label;

  @override
  State<LoginPrimaryButton> createState() => _LoginPrimaryButtonState();
}

class _LoginPrimaryButtonState extends State<LoginPrimaryButton> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final disabled = widget.onPressed == null || widget.loading;

    final colors = _hovered && !disabled
        ? [LoginBrand.blue500, LoginBrand.blue600]
        : [LoginBrand.blue600, LoginBrand.blue700];

    return MouseRegion(
      cursor: disabled ? SystemMouseCursors.basic : SystemMouseCursors.click,
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: GestureDetector(
        onTap: disabled ? null : widget.onPressed,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOutCubic,
          width: double.infinity,
          height: 48,
          transform: _hovered && !disabled
              ? (Matrix4.identity()..translate(0.0, -1.0))
              : Matrix4.identity(),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: disabled
                  ? [
                      LoginBrand.blue700.withValues(alpha: 0.5),
                      LoginBrand.blue700.withValues(alpha: 0.4),
                    ]
                  : colors,
            ),
            borderRadius: BorderRadius.circular(12),
            boxShadow: disabled
                ? null
                : [
                    BoxShadow(
                      color: LoginBrand.blue600.withValues(
                          alpha: _hovered ? 0.5 : 0.4),
                      blurRadius: _hovered ? 25 : 15,
                      offset: Offset(0, _hovered ? 8 : 4),
                    ),
                  ],
          ),
          alignment: Alignment.center,
          child: widget.loading
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                  ),
                )
              : Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      widget.label.toUpperCase(),
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.65,
                        color: Colors.white.withValues(
                            alpha: disabled ? 0.6 : 1.0),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Icon(
                      Icons.arrow_forward_rounded,
                      size: 16,
                      color: Colors.white.withValues(
                          alpha: disabled ? 0.6 : 1.0),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}
