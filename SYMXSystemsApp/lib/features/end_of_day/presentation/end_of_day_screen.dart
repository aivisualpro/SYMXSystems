import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_retry_card.dart';
import '../data/end_of_day_repository.dart';

/// Provider for today's end-of-day checklist. Re-fetch by invalidating.
final endOfDayTasksProvider = FutureProvider<List<EndOfDayTask>>((ref) async {
  return ref.read(endOfDayRepositoryProvider).getTasks();
});

/// End-of-day checklist tab — replaces the old "Coming Soon" placeholder.
///
/// A driver taps each item to complete it; photo-required items open the
/// camera first and only complete once a photo is attached. Completing
/// and undoing both hit the backend immediately (no separate "Submit"
/// step) so progress is never lost if the app is closed mid-checklist.
class EndOfDayScreen extends ConsumerWidget {
  const EndOfDayScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tasksAsync = ref.watch(endOfDayTasksProvider);

    return tasksAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => ErrorRetryCard(
        message: 'Could not load today\'s end-of-day tasks.',
        onRetry: () => ref.invalidate(endOfDayTasksProvider),
      ),
      data: (tasks) => _TaskList(tasks: tasks),
    );
  }
}

class _TaskList extends ConsumerWidget {
  const _TaskList({required this.tasks});
  final List<EndOfDayTask> tasks;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (tasks.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.checklist_rtl_rounded,
                size: 48,
                color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.2),
              ),
              const SizedBox(height: 16),
              Text(
                'No end-of-day tasks yet',
                style: GoogleFonts.inter(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: isDark ? AppTheme.textOnDark : AppTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Your dispatcher hasn\'t set up a checklist yet.',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 13,
                  color: isDark ? AppTheme.textSecondaryDark : AppTheme.textSecondary,
                ),
              ),
            ],
          ),
        ),
      );
    }

    final completedCount = tasks.where((t) => t.completed).length;
    final allDone = completedCount == tasks.length;

    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(endOfDayTasksProvider),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          // ── Progress header ──
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: allDone
                  ? AppTheme.accentEmerald.withValues(alpha: 0.1)
                  : (isDark ? AppTheme.cardDark : Colors.white),
              borderRadius: BorderRadius.circular(AppTheme.borderRadiusSm),
              border: Border.all(
                color: allDone
                    ? AppTheme.accentEmerald.withValues(alpha: 0.3)
                    : (isDark ? AppTheme.borderDark : AppTheme.dividerLight),
              ),
            ),
            child: Row(
              children: [
                Icon(
                  allDone ? Icons.check_circle_rounded : Icons.pending_actions_rounded,
                  color: allDone ? AppTheme.accentEmerald : AppTheme.primaryIndigo,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    allDone
                        ? 'All done for today!'
                        : '$completedCount of ${tasks.length} completed',
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: isDark ? AppTheme.textOnDark : AppTheme.textPrimary,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          ...tasks.map((task) => _TaskCard(task: task)),
        ],
      ),
    );
  }
}

class _TaskCard extends ConsumerStatefulWidget {
  const _TaskCard({required this.task});
  final EndOfDayTask task;

  @override
  ConsumerState<_TaskCard> createState() => _TaskCardState();
}

class _TaskCardState extends ConsumerState<_TaskCard> {
  bool _busy = false;

  Future<void> _toggle() async {
    if (_busy) return;
    final repo = ref.read(endOfDayRepositoryProvider);
    final task = widget.task;

    if (task.completed) {
      setState(() => _busy = true);
      try {
        await repo.uncompleteTask(task.id);
        ref.invalidate(endOfDayTasksProvider);
        HapticFeedback.selectionClick();
      } catch (_) {
        if (mounted) _showError('Failed to update — check your connection.');
      } finally {
        if (mounted) setState(() => _busy = false);
      }
      return;
    }

    String? photoUrl;
    if (task.requiresPhoto) {
      final picker = ImagePicker();
      final picked = await picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 80,
        maxWidth: 1600,
      );
      if (picked == null) return; // cancelled — leave task incomplete

      setState(() => _busy = true);
      photoUrl = await repo.uploadPhoto(File(picked.path));
      if (photoUrl == null) {
        if (mounted) {
          setState(() => _busy = false);
          _showError('Photo upload failed — try again.');
        }
        return;
      }
    } else {
      setState(() => _busy = true);
    }

    try {
      await repo.completeTask(task.id, photoUrl: photoUrl);
      ref.invalidate(endOfDayTasksProvider);
      HapticFeedback.mediumImpact();
    } catch (_) {
      if (mounted) _showError('Failed to save — check your connection.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
        behavior: SnackBarBehavior.floating,
        backgroundColor: AppTheme.errorRed,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final task = widget.task;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: task.completed
            ? AppTheme.accentEmerald.withValues(alpha: 0.06)
            : (isDark ? AppTheme.cardDark : Colors.white),
        borderRadius: BorderRadius.circular(AppTheme.borderRadiusSm),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppTheme.borderRadiusSm),
          onTap: _busy ? null : _toggle,
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppTheme.borderRadiusSm),
              border: Border.all(
                color: task.completed
                    ? AppTheme.accentEmerald.withValues(alpha: 0.3)
                    : (isDark ? AppTheme.borderDark : AppTheme.dividerLight),
              ),
            ),
            child: Row(
              children: [
                // ── Checkbox / spinner ──
                SizedBox(
                  width: 26,
                  height: 26,
                  child: _busy
                      ? const Padding(
                          padding: EdgeInsets.all(3),
                          child: CircularProgressIndicator(strokeWidth: 2.5),
                        )
                      : Container(
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: task.completed ? AppTheme.accentEmerald : Colors.transparent,
                            border: Border.all(
                              color: task.completed
                                  ? AppTheme.accentEmerald
                                  : (isDark ? AppTheme.textSecondaryDark : AppTheme.textSecondary),
                              width: 2,
                            ),
                          ),
                          child: task.completed
                              ? const Icon(Icons.check_rounded, size: 16, color: Colors.white)
                              : null,
                        ),
                ),
                const SizedBox(width: 14),

                // ── Title / description ──
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        task.title,
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          decoration: task.completed ? TextDecoration.lineThrough : null,
                          color: task.completed
                              ? (isDark ? AppTheme.textSecondaryDark : AppTheme.textSecondary)
                              : (isDark ? AppTheme.textOnDark : AppTheme.textPrimary),
                        ),
                      ),
                      if (task.description.isNotEmpty) ...[
                        const SizedBox(height: 3),
                        Text(
                          task.description,
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            color: isDark ? AppTheme.textSecondaryDark : AppTheme.textSecondary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),

                if (task.requiresPhoto && !task.completed)
                  Icon(
                    Icons.camera_alt_outlined,
                    size: 18,
                    color: isDark ? AppTheme.textSecondaryDark : AppTheme.textSecondary,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
