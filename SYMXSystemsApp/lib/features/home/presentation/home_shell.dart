import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/theme/app_theme.dart';
import '../../auth/data/auth_repository.dart';
import 'welcome_overlay.dart';

// ─── Tab Metadata ──────────────────────────────────────────────────
class _Tab {
  const _Tab({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.title,
  });
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final String title; // AppBar title
}

const _kTabs = <_Tab>[
  _Tab(
    icon: Icons.fact_check_outlined,
    activeIcon: Icons.fact_check,
    label: 'Inspections',
    title: 'Daily Inspections',
  ),
  _Tab(
    icon: Icons.campaign_outlined,
    activeIcon: Icons.campaign,
    label: 'Notices',
    title: 'Notices',
  ),
  _Tab(
    icon: Icons.auto_awesome_outlined,
    activeIcon: Icons.auto_awesome,
    label: 'Coming Soon',
    title: 'Coming Soon',
  ),
];

/// Shell widget that provides the AppBar + bottom navigation bar.
///
/// Uses [StatefulNavigationShell] from go_router to preserve
/// each tab's navigation state independently.
/// Supports keyboard shortcuts on web/desktop: 1/2/3 for tabs, R to refresh.
class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> {
  final _focusNode = FocusNode();

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  KeyEventResult _handleKey(FocusNode node, KeyEvent event) {
    final label = event.logicalKey.keyLabel;

    // Tab switching: 1, 2, 3
    if (label == '1') {
      widget.navigationShell.goBranch(0, initialLocation: widget.navigationShell.currentIndex == 0);
      return KeyEventResult.handled;
    } else if (label == '2') {
      widget.navigationShell.goBranch(1, initialLocation: widget.navigationShell.currentIndex == 1);
      return KeyEventResult.handled;
    } else if (label == '3') {
      widget.navigationShell.goBranch(2, initialLocation: widget.navigationShell.currentIndex == 2);
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    final currentIdx = widget.navigationShell.currentIndex;
    final showWelcome = ref.watch(showWelcomeOverlayProvider);

    return Focus(
      focusNode: _focusNode,
      autofocus: true,
      onKeyEvent: _handleKey,
      child: Stack(
        children: [
          // ── Main scaffold ──
          Scaffold(
            appBar: _HomeAppBar(
              title: _kTabs[currentIdx].title,
            ),
            body: widget.navigationShell,
            bottomNavigationBar: _AnimatedBottomNav(
              currentIndex: currentIdx,
              onTap: (i) => widget.navigationShell.goBranch(
                i,
                initialLocation: i == currentIdx,
              ),
            ),
          ),

          // ── Welcome overlay (first visit only) ──
          if (showWelcome) const WelcomeOverlay(),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// APP BAR
// ═══════════════════════════════════════════════════════════════════

class _HomeAppBar extends ConsumerWidget implements PreferredSizeWidget {
  const _HomeAppBar({required this.title});
  final String title;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final employee = ref.watch(currentEmployeeProvider);

    // Build initials from employee name.
    final initials = employee.whenOrNull(
          data: (e) {
            if (e == null) return '?';
            final f = e.firstName.isNotEmpty ? e.firstName[0] : '';
            final l = e.lastName.isNotEmpty ? e.lastName[0] : '';
            return '$f$l'.toUpperCase();
          },
        ) ??
        '?';

    return AppBar(
      backgroundColor: isDark ? AppTheme.surfaceDark : Colors.white,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0.5,

      // ── Left: Profile circle ──
      leading: Padding(
        padding: const EdgeInsets.only(left: 12),
        child: Center(
          child: GestureDetector(
            onTap: () => _showProfileDrawer(context, ref),
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppTheme.primaryIndigo, AppTheme.accentEmerald],
                ),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.primaryIndigo.withValues(alpha: 0.25),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Center(
                child: Text(
                  initials,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),

      // ── Center: Tab title ──
      centerTitle: true,
      title: Text(
        title,
        style: GoogleFonts.inter(
          fontSize: 17,
          fontWeight: FontWeight.w600,
          color: isDark ? AppTheme.textOnDark : AppTheme.textPrimary,
        ),
      ),

      // ── Right: Notification bell ──
      actions: [
        Padding(
          padding: const EdgeInsets.only(right: 12),
          child: IconButton(
            onPressed: () {
              // Placeholder — will open notifications in a later prompt.
            },
            icon: Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(
                  Icons.notifications_outlined,
                  size: 24,
                  color: isDark
                      ? AppTheme.textSecondaryDark
                      : AppTheme.textSecondary,
                ),
                // Badge dot
                Positioned(
                  top: -2,
                  right: -2,
                  child: Container(
                    width: 9,
                    height: 9,
                    decoration: BoxDecoration(
                      color: AppTheme.accentEmerald,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: isDark ? AppTheme.surfaceDark : Colors.white,
                        width: 1.5,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],

      // Bottom border
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1),
        child: Container(
          height: 1,
          color: isDark ? AppTheme.dividerDark : AppTheme.dividerLight,
        ),
      ),
    );
  }

  void _showProfileDrawer(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final employee = ref.read(currentEmployeeProvider).valueOrNull;

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      backgroundColor: isDark ? AppTheme.cardDark : Colors.white,
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Drag handle
                Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 24),
                  decoration: BoxDecoration(
                    color: (isDark ? Colors.white : Colors.black)
                        .withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),

                // Avatar
                Container(
                  width: 64,
                  height: 64,
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [AppTheme.primaryIndigo, AppTheme.accentEmerald],
                    ),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text(
                      employee != null
                          ? '${employee.firstName.isNotEmpty ? employee.firstName[0] : ''}${employee.lastName.isNotEmpty ? employee.lastName[0] : ''}'
                              .toUpperCase()
                          : '?',
                      style: GoogleFonts.inter(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 16),

                Text(
                  employee?.fullName ?? 'Driver',
                  style: theme.textTheme.headlineSmall,
                ),
                const SizedBox(height: 4),
                Text(
                  employee != null
                      ? 'Badge #${employee.badgeNumber} • ${employee.type}'
                      : '',
                  style: theme.textTheme.bodySmall,
                ),

                const SizedBox(height: 28),

                // Logout button
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      Navigator.of(ctx).pop();
                      await ref.read(authRepositoryProvider).logout();
                      ref.invalidate(currentEmployeeProvider);
                      if (context.mounted) context.go('/login');
                    },
                    icon: const Icon(Icons.logout_rounded, size: 18),
                    label: const Text('Sign Out'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppTheme.errorRed,
                      side: BorderSide(
                        color: AppTheme.errorRed.withValues(alpha: 0.4),
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// ANIMATED BOTTOM NAV
// ═══════════════════════════════════════════════════════════════════

class _AnimatedBottomNav extends StatelessWidget {
  const _AnimatedBottomNav({
    required this.currentIndex,
    required this.onTap,
  });

  final int currentIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final bgColor = isDark ? AppTheme.surfaceDark : Colors.white;

    return Container(
      decoration: BoxDecoration(
        color: bgColor,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.06),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            children: List.generate(_kTabs.length, (i) {
              final tab = _kTabs[i];
              final selected = i == currentIndex;

              return Expanded(
                child: GestureDetector(
                  onTap: () => onTap(i),
                  behavior: HitTestBehavior.opaque,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    curve: Curves.easeOutCubic,
                    padding: EdgeInsets.symmetric(
                      vertical: 8,
                      horizontal: selected ? 12 : 8,
                    ),
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    decoration: BoxDecoration(
                      color: selected
                          ? AppTheme.primaryIndigo.withValues(alpha: 0.1)
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        AnimatedSwitcher(
                          duration: const Duration(milliseconds: 200),
                          child: Icon(
                            selected ? tab.activeIcon : tab.icon,
                            key: ValueKey(selected),
                            size: 22,
                            color: selected
                                ? AppTheme.primaryIndigo
                                : (isDark
                                    ? AppTheme.textSecondaryDark
                                    : AppTheme.textSecondary),
                          ),
                        ),
                        // Label fades in only when selected.
                        AnimatedSize(
                          duration: const Duration(milliseconds: 250),
                          curve: Curves.easeOutCubic,
                          child: selected
                              ? Padding(
                                  padding: const EdgeInsets.only(left: 8),
                                  child: Text(
                                    tab.label,
                                    style: GoogleFonts.inter(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: AppTheme.primaryIndigo,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                )
                              : const SizedBox.shrink(),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }
}
