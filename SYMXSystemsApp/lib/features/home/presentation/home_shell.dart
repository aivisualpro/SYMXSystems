import 'package:cached_network_image/cached_network_image.dart';
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
      widget.navigationShell.goBranch(0,
          initialLocation: widget.navigationShell.currentIndex == 0);
      return KeyEventResult.handled;
    } else if (label == '2') {
      widget.navigationShell.goBranch(1,
          initialLocation: widget.navigationShell.currentIndex == 1);
      return KeyEventResult.handled;
    } else if (label == '3') {
      widget.navigationShell.goBranch(2,
          initialLocation: widget.navigationShell.currentIndex == 2);
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
            backgroundColor: Theme.of(context).brightness == Brightness.dark
                ? AppTheme.bgDark
                : AppTheme.surfaceLight,
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
  Size get preferredSize => const Size.fromHeight(72);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final employee = ref.watch(currentEmployeeProvider);
    final emp = employee.valueOrNull;

    final firstName = emp?.firstName.isNotEmpty == true
        ? emp!.firstName
        : 'Driver';
    final initials = emp == null
        ? '?'
        : '${emp.firstName.isNotEmpty ? emp.firstName[0] : ''}${emp.lastName.isNotEmpty ? emp.lastName[0] : ''}'
            .toUpperCase();
    final profileUrl = emp?.profileImage ?? '';

    return AppBar(
      backgroundColor: isDark ? AppTheme.bgDark : Colors.white,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      automaticallyImplyLeading: false,
      toolbarHeight: 72,

      // ── Left: Profile pill (avatar + greeting) ──
      titleSpacing: 0,
      title: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: [
            // Tappable profile pill (flexible so long names don't overflow)
            Flexible(
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(40),
                  onTap: () => _showProfileDrawer(context, ref),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(4, 4, 14, 4),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _ProfileAvatar(
                          imageUrl: profileUrl,
                          initials: initials,
                          size: 44,
                          fontSize: 15,
                        ),
                        const SizedBox(width: 10),
                        Flexible(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'Hi, $firstName',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.inter(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: isDark
                                      ? AppTheme.textOnDark
                                      : AppTheme.textPrimary,
                                  letterSpacing: -0.2,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.inter(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                  color: isDark
                                      ? AppTheme.textSecondaryDark
                                      : AppTheme.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),

            // ── Right: Notification bell ──
            IconButton(
              onPressed: () {},
              tooltip: 'Notifications',
              icon: Stack(
                clipBehavior: Clip.none,
                children: [
                  Icon(
                    Icons.notifications_outlined,
                    size: 22,
                    color: isDark
                        ? AppTheme.textSecondaryDark
                        : AppTheme.textSecondary,
                  ),
                  Positioned(
                    top: -2,
                    right: -2,
                    child: Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: AppTheme.accentEmerald,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: isDark ? AppTheme.bgDark : Colors.white,
                          width: 1.5,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),

      // Bottom hairline
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1),
        child: Container(
          height: 1,
          color: isDark ? AppTheme.borderDark : AppTheme.dividerLight,
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
                _ProfileAvatar(
                  imageUrl: employee?.profileImage ?? '',
                  initials: employee != null
                      ? '${employee.firstName.isNotEmpty ? employee.firstName[0] : ''}${employee.lastName.isNotEmpty ? employee.lastName[0] : ''}'
                          .toUpperCase()
                      : '?',
                  size: 64,
                  fontSize: 22,
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
// PROFILE AVATAR — shows network image with initials fallback
// ═══════════════════════════════════════════════════════════════════

class _ProfileAvatar extends StatelessWidget {
  const _ProfileAvatar({
    required this.imageUrl,
    required this.initials,
    this.size = 36,
    this.fontSize = 13,
  });

  final String imageUrl;
  final String initials;
  final double size;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final hasImage = imageUrl.isNotEmpty;

    return Container(
      width: size,
      height: size,
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
      child: hasImage
          ? ClipOval(
              child: CachedNetworkImage(
                imageUrl: imageUrl,
                width: size,
                height: size,
                fit: BoxFit.cover,
                placeholder: (_, __) => Center(
                  child: Text(
                    initials,
                    style: GoogleFonts.inter(
                      fontSize: fontSize,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
                errorWidget: (_, __, ___) => Center(
                  child: Text(
                    initials,
                    style: GoogleFonts.inter(
                      fontSize: fontSize,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            )
          : Center(
              child: Text(
                initials,
                style: GoogleFonts.inter(
                  fontSize: fontSize,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
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
    final bgColor = isDark ? AppTheme.bgDark : Colors.white;

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
                        if (selected)
                          Flexible(
                            child: Padding(
                              padding: const EdgeInsets.only(left: 6),
                              child: Text(
                                tab.label,
                                style: GoogleFonts.inter(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: AppTheme.primaryIndigo,
                                ),
                                overflow: TextOverflow.ellipsis,
                                maxLines: 1,
                              ),
                            ),
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
