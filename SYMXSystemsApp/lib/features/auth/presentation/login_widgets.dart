import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:pin_code_fields/pin_code_fields.dart';

import '../../../core/theme/app_theme.dart';

/// Animated gradient background that cycles between indigo↔emerald.
class LoginGradientBg extends StatelessWidget {
  const LoginGradientBg({super.key, required this.flip});
  final bool flip;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(seconds: 6),
      curve: Curves.easeInOut,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: flip ? Alignment.topLeft : Alignment.bottomRight,
          end: flip ? Alignment.bottomRight : Alignment.topLeft,
          colors: flip
              ? const [
                  Color(0xFF1E1B4B), // deep indigo
                  Color(0xFF0F172A), // slate-900
                  Color(0xFF064E3B), // emerald-900
                ]
              : const [
                  Color(0xFF064E3B),
                  Color(0xFF0F172A),
                  Color(0xFF1E1B4B),
                ],
        ),
      ),
    );
  }
}

/// SYMX wordmark with a gradient icon.
class LoginWordmark extends StatelessWidget {
  const LoginWordmark({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppTheme.primaryIndigo, AppTheme.accentEmerald],
            ),
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: AppTheme.primaryIndigo.withValues(alpha: 0.4),
                blurRadius: 28,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: const Icon(
            Icons.local_shipping_rounded,
            size: 36,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 20),
        Text(
          'SYMX',
          style: GoogleFonts.inter(
            fontSize: 32,
            fontWeight: FontWeight.w800,
            letterSpacing: 6,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          'SYSTEMS',
          style: GoogleFonts.inter(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            letterSpacing: 8,
            color: Colors.white.withValues(alpha: 0.45),
          ),
        ),
      ],
    );
  }
}

/// Frosted-glass card with backdrop blur.
class LoginGlassCard extends StatelessWidget {
  const LoginGlassCard({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 36),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.12),
              width: 1,
            ),
          ),
          child: child,
        ),
      ),
    );
  }
}

/// 4-digit numeric PIN input using [PinCodeTextField].
class LoginPinInput extends StatelessWidget {
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
  Widget build(BuildContext context) {
    return PinCodeTextField(
      appContext: context,
      length: 4,
      controller: controller,
      focusNode: focusNode,
      autoFocus: true,
      enabled: enabled,
      animationType: AnimationType.scale,
      keyboardType: TextInputType.number,
      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
      hapticFeedbackTypes: HapticFeedbackTypes.light,
      textStyle: GoogleFonts.inter(
        fontSize: 28,
        fontWeight: FontWeight.w700,
        color: Colors.white,
      ),
      pinTheme: PinTheme(
        shape: PinCodeFieldShape.box,
        borderRadius: BorderRadius.circular(16),
        fieldHeight: 64,
        fieldWidth: 60,
        activeFillColor: Colors.white.withValues(alpha: 0.12),
        selectedFillColor: Colors.white.withValues(alpha: 0.15),
        inactiveFillColor: Colors.white.withValues(alpha: 0.06),
        activeColor: AppTheme.primaryIndigo,
        selectedColor: AppTheme.accentEmerald,
        inactiveColor: Colors.white.withValues(alpha: 0.2),
        fieldOuterPadding: const EdgeInsets.symmetric(horizontal: 6),
      ),
      enableActiveFill: true,
      cursorColor: AppTheme.accentEmerald,
      animationDuration: const Duration(milliseconds: 200),
      onCompleted: onCompleted,
      onChanged: (_) {},
    );
  }
}

/// Inline error chip with a warning icon.
class LoginErrorChip extends StatelessWidget {
  const LoginErrorChip({super.key, required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: AppTheme.errorRed.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: AppTheme.errorRed.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.error_outline_rounded,
            size: 18,
            color: AppTheme.errorRed.withValues(alpha: 0.9),
          ),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              message,
              style: GoogleFonts.inter(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: AppTheme.errorRed.withValues(alpha: 0.9),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
