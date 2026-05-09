import 'package:flutter/material.dart';

/// Constrains content to [kMaxContentWidth] on large screens while
/// centering the content with horizontal padding.
///
/// Use this around page bodies that should not stretch endlessly on
/// ultrawide monitors. Screens that explicitly need full width (e.g.
/// the 2-column inspections grid) can skip this wrapper.
class ContentConstraint extends StatelessWidget {
  const ContentConstraint({
    super.key,
    required this.child,
    this.maxWidth = 1200,
  });

  final Widget child;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: child,
      ),
    );
  }
}
