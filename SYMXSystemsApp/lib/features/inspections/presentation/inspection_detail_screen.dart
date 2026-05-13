import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../../core/theme/app_theme.dart';
import '../data/inspection_repository.dart';

/// Full-screen detail view for a completed daily inspection.
/// Shows all data + photos in a mobile-optimised bento layout.
///
/// Accepts either [inspectionId] (direct lookup) or [routeId]
/// (latest inspection for that route). At least one must be provided.
class InspectionDetailScreen extends ConsumerStatefulWidget {
  const InspectionDetailScreen({
    super.key,
    this.inspectionId = '',
    this.routeId = '',
  });
  final String inspectionId;
  final String routeId;

  @override
  ConsumerState<InspectionDetailScreen> createState() =>
      _InspectionDetailScreenState();
}

class _InspectionDetailScreenState
    extends ConsumerState<InspectionDetailScreen> {
  Map<String, dynamic>? _data;
  bool _loading = true;
  String? _lightboxUrl;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    final repo = ref.read(inspectionRepositoryProvider);
    Map<String, dynamic>? d;

    if (widget.inspectionId.isNotEmpty) {
      d = await repo.getInspectionDetail(widget.inspectionId);
    } else if (widget.routeId.isNotEmpty) {
      d = await repo.getInspectionByRouteId(widget.routeId);
    }

    if (mounted) setState(() { _data = d; _loading = false; });
  }

  // ── Date formatter ──
  String _fmtDate(dynamic v) {
    if (v == null) return '—';
    final d = DateTime.tryParse(v.toString());
    if (d == null) return '—';
    const months = [
      'Jan','Feb','Mar','Apr','May','Jun',
      'Jul','Aug','Sep','Oct','Nov','Dec',
    ];
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    return '${days[d.weekday - 1]}, ${months[d.month - 1]} ${d.day}, ${d.year}';
  }

  String _fmtTime(dynamic v) {
    if (v == null) return '—';
    final d = DateTime.tryParse(v.toString());
    if (d == null) return '—';
    final h = d.hour > 12 ? d.hour - 12 : (d.hour == 0 ? 12 : d.hour);
    final ampm = d.hour >= 12 ? 'PM' : 'AM';
    return '$h:${d.minute.toString().padLeft(2, '0')} $ampm';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppTheme.surfaceDark : const Color(0xFFF5F5F7),
      appBar: AppBar(
        backgroundColor: isDark ? AppTheme.surfaceDark : Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          'Inspection Detail',
          style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w600),
        ),
        centerTitle: true,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(
            height: 1,
            color: isDark ? AppTheme.dividerDark : AppTheme.dividerLight,
          ),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _data == null
              ? Center(
                  child: Text(
                    'Inspection not found',
                    style: GoogleFonts.inter(color: theme.textTheme.bodySmall?.color),
                  ),
                )
              : Stack(
                  children: [
                    _buildBody(theme, isDark),
                    if (_lightboxUrl != null) _buildLightbox(),
                  ],
                ),
    );
  }

  Widget _buildBody(ThemeData theme, bool isDark) {
    final d = _data!;
    final hasRepair =
        d['anyRepairs'] == 'TRUE' || d['anyRepairs'] == 'true';

    final photos = <Map<String, String>>[
      {'url': (d['vehiclePicture1'] ?? '').toString(), 'label': 'Passenger Side'},
      {'url': (d['vehiclePicture2'] ?? '').toString(), 'label': 'Back'},
      {'url': (d['vehiclePicture3'] ?? '').toString(), 'label': 'Driver Side'},
      {'url': (d['vehiclePicture4'] ?? '').toString(), 'label': 'Front'},
      {'url': (d['dashboardImage'] ?? '').toString(), 'label': 'Dashboard'},
    ];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ── Info cards row 1: Date + VIN ──
        Row(
          children: [
            Expanded(
              child: _infoCard(
                icon: Icons.calendar_today_outlined,
                iconColor: Colors.blue,
                label: 'Date',
                value: _fmtDate(d['routeDate']),
                isDark: isDark,
                theme: theme,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _infoCard(
                icon: Icons.confirmation_number_outlined,
                iconColor: Colors.teal,
                label: 'VIN',
                value: d['vehicleName'] != null && (d['vehicleName'] as String).isNotEmpty
                    ? '${d['vehicleName']}'
                    : (d['vin'] ?? '—'),
                isDark: isDark,
                theme: theme,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),

        // ── Info cards row 2: Mileage + Repairs ──
        Row(
          children: [
            Expanded(
              child: _bigNumberCard(
                icon: Icons.speed_outlined,
                iconColor: Colors.orange,
                label: 'Mileage',
                value: d['mileage'] != null && d['mileage'] > 0
                    ? '${d['mileage']}'
                    : '—',
                suffix: 'miles',
                isDark: isDark,
                theme: theme,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _bigNumberCard(
                icon: Icons.build_outlined,
                iconColor: hasRepair ? Colors.red : AppTheme.accentEmerald,
                label: 'Repairs',
                value: hasRepair ? 'Yes' : 'No',
                suffix: hasRepair
                    ? (d['repairCurrentStatus'] ?? '')
                    : '',
                isDark: isDark,
                theme: theme,
                valueColor: hasRepair ? Colors.red : AppTheme.accentEmerald,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),

        // ── Info cards row 3: Driver + InspectedBy ──
        Row(
          children: [
            Expanded(
              child: _infoCard(
                icon: Icons.person_outline,
                iconColor: Colors.purple,
                label: 'Driver',
                value: d['employeeName'] ?? d['driver'] ?? '—',
                isDark: isDark,
                theme: theme,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _infoCard(
                icon: Icons.access_time_outlined,
                iconColor: Colors.cyan,
                label: 'Timestamp',
                value: _fmtTime(d['timeStamp']),
                isDark: isDark,
                theme: theme,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),

        // ── Comments ──
        if ((d['comments'] ?? '').toString().isNotEmpty) ...[
          _sectionCard(
            icon: Icons.chat_bubble_outline,
            iconColor: Colors.pink,
            label: 'Comments',
            child: Text(
              d['comments'],
              style: GoogleFonts.inter(
                fontSize: 13,
                color: theme.textTheme.bodyLarge?.color,
                height: 1.5,
              ),
            ),
            isDark: isDark,
            theme: theme,
          ),
          const SizedBox(height: 10),
        ],

        // ── Repair detail ──
        if (hasRepair) ...[
          _sectionCard(
            icon: Icons.build_outlined,
            iconColor: Colors.red,
            label: 'Repair Information',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if ((d['repairDescription'] ?? '').toString().isNotEmpty)
                  _miniField('Description', d['repairDescription'], theme),
                if ((d['repairCurrentStatus'] ?? '').toString().isNotEmpty)
                  _miniField('Status', d['repairCurrentStatus'], theme),
              ],
            ),
            isDark: isDark,
            theme: theme,
          ),
          const SizedBox(height: 10),
        ],

        // ── Photo Gallery ──
        _photoGallerySection(photos, isDark, theme),
        const SizedBox(height: 24),
      ],
    );
  }

  // ── Info Card ──
  Widget _infoCard({
    required IconData icon,
    required Color iconColor,
    required String label,
    required String value,
    required bool isDark,
    required ThemeData theme,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? AppTheme.dividerDark : AppTheme.dividerLight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 18, color: iconColor),
          ),
          const SizedBox(height: 10),
          Text(
            label.toUpperCase(),
            style: GoogleFonts.inter(
              fontSize: 9,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
              color: theme.textTheme.bodySmall?.color?.withValues(alpha: 0.5),
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: GoogleFonts.inter(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: theme.textTheme.bodyLarge?.color,
            ),
          ),
        ],
      ),
    );
  }

  // ── Big Number Card ──
  Widget _bigNumberCard({
    required IconData icon,
    required Color iconColor,
    required String label,
    required String value,
    required String suffix,
    required bool isDark,
    required ThemeData theme,
    Color? valueColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? AppTheme.dividerDark : AppTheme.dividerLight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 18, color: iconColor),
          ),
          const SizedBox(height: 10),
          Text(
            label.toUpperCase(),
            style: GoogleFonts.inter(
              fontSize: 9,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
              color: theme.textTheme.bodySmall?.color?.withValues(alpha: 0.5),
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: valueColor ?? theme.textTheme.bodyLarge?.color,
            ),
          ),
          if (suffix.isNotEmpty)
            Text(
              suffix,
              style: GoogleFonts.inter(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: theme.textTheme.bodySmall?.color?.withValues(alpha: 0.4),
              ),
            ),
        ],
      ),
    );
  }

  // ── Section Card ──
  Widget _sectionCard({
    required IconData icon,
    required Color iconColor,
    required String label,
    required Widget child,
    required bool isDark,
    required ThemeData theme,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? AppTheme.dividerDark : AppTheme.dividerLight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 16, color: iconColor),
              ),
              const SizedBox(width: 10),
              Text(
                label,
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: theme.textTheme.bodyLarge?.color,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }

  Widget _miniField(String label, String value, ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: GoogleFonts.inter(
              fontSize: 9,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.0,
              color: theme.textTheme.bodySmall?.color?.withValues(alpha: 0.4),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 13,
              color: theme.textTheme.bodyLarge?.color,
            ),
          ),
        ],
      ),
    );
  }

  // ── Photo Gallery ──
  Widget _photoGallerySection(
    List<Map<String, String>> photos,
    bool isDark,
    ThemeData theme,
  ) {
    final hasPhotos = photos.any((p) => (p['url'] ?? '').isNotEmpty);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? AppTheme.dividerDark : AppTheme.dividerLight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppTheme.primaryIndigo.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(Icons.camera_alt_outlined,
                    size: 16, color: AppTheme.primaryIndigo),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Inspection Photos',
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: theme.textTheme.bodyLarge?.color,
                    ),
                  ),
                  Text(
                    '${photos.where((p) => (p['url'] ?? '').isNotEmpty).length} of 5 photos captured',
                    style: GoogleFonts.inter(
                      fontSize: 10,
                      color: theme.textTheme.bodySmall?.color?.withValues(alpha: 0.5),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 14),

          if (!hasPhotos)
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 20),
                child: Column(
                  children: [
                    Icon(Icons.camera_alt_outlined,
                        size: 32,
                        color: theme.textTheme.bodySmall?.color
                            ?.withValues(alpha: 0.2)),
                    const SizedBox(height: 8),
                    Text(
                      'No photos',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: theme.textTheme.bodySmall?.color
                            ?.withValues(alpha: 0.3),
                      ),
                    ),
                  ],
                ),
              ),
            )
          else ...[
            // Row 1: 3 photos
            Row(
              children: [
                for (int i = 0; i < 3; i++) ...[
                  if (i > 0) const SizedBox(width: 8),
                  Expanded(
                    child: _photoTile(
                      photos[i]['url']!,
                      photos[i]['label']!,
                      isDark,
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 8),
            // Row 2: 2 photos + spacer
            Row(
              children: [
                for (int i = 3; i < 5; i++) ...[
                  if (i > 3) const SizedBox(width: 8),
                  Expanded(
                    child: _photoTile(
                      photos[i]['url']!,
                      photos[i]['label']!,
                      isDark,
                    ),
                  ),
                ],
                const SizedBox(width: 8),
                const Expanded(child: SizedBox()),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _photoTile(String url, String label, bool isDark) {
    if (url.isEmpty) {
      return AspectRatio(
        aspectRatio: 1,
        child: Container(
          decoration: BoxDecoration(
            color: isDark
                ? Colors.white.withValues(alpha: 0.03)
                : Colors.black.withValues(alpha: 0.03),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isDark ? AppTheme.dividerDark : AppTheme.dividerLight,
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.camera_alt_outlined,
                  size: 18,
                  color: isDark ? Colors.white24 : Colors.black12),
              const SizedBox(height: 4),
              Text(
                label,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 8,
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white24 : Colors.black26,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return GestureDetector(
      onTap: () => setState(() => _lightboxUrl = url),
      child: AspectRatio(
        aspectRatio: 1,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isDark ? AppTheme.dividerDark : AppTheme.dividerLight,
            ),
          ),
          clipBehavior: Clip.antiAlias,
          child: Stack(
            fit: StackFit.expand,
            children: [
              CachedNetworkImage(
                imageUrl: url,
                fit: BoxFit.cover,
                placeholder: (_, __) => Container(
                  color: isDark ? Colors.white10 : Colors.black.withValues(alpha: 0.05),
                  child: const Center(
                    child: SizedBox(
                      width: 16, height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                ),
                errorWidget: (_, __, ___) => Container(
                  color: isDark ? Colors.white10 : Colors.black.withValues(alpha: 0.05),
                  child: const Icon(Icons.broken_image_outlined, size: 18),
                ),
              ),
              // Bottom gradient label
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: Container(
                  padding: const EdgeInsets.fromLTRB(6, 16, 6, 5),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Colors.transparent, Colors.black.withValues(alpha: 0.6)],
                    ),
                  ),
                  child: Text(
                    label,
                    style: GoogleFonts.inter(
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Lightbox overlay ──
  Widget _buildLightbox() {
    return GestureDetector(
      onTap: () => setState(() => _lightboxUrl = null),
      child: Container(
        color: Colors.black.withValues(alpha: 0.95),
        child: Stack(
          children: [
            Center(
              child: InteractiveViewer(
                child: CachedNetworkImage(
                  imageUrl: _lightboxUrl!,
                  fit: BoxFit.contain,
                ),
              ),
            ),
            Positioned(
              top: MediaQuery.of(context).padding.top + 8,
              right: 16,
              child: GestureDetector(
                onTap: () => setState(() => _lightboxUrl = null),
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.close, color: Colors.white, size: 20),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
