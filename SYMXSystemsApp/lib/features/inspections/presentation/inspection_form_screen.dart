import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/models/route_row.dart';
import '../data/inspection_repository.dart';
import '../data/routes_repository.dart';
import 'inspection_widgets.dart';

/// Full-screen inspection form for a single route.
class InspectionFormScreen extends ConsumerStatefulWidget {
  const InspectionFormScreen({super.key, required this.route});
  final RouteRow route;

  @override
  ConsumerState<InspectionFormScreen> createState() =>
      _InspectionFormScreenState();
}

class _InspectionFormScreenState extends ConsumerState<InspectionFormScreen> {
  final _mileageCtrl = TextEditingController();
  final _commentsCtrl = TextEditingController();
  final _repairDescCtrl = TextEditingController();
  bool _anyRepairs = false;
  bool _saving = false;
  int? _lastMileage;

  // Photo slots: passenger, back, driver, front, dashboard
  final List<String> _photoLabels = [
    'Passenger Side',
    'Back Photo',
    'Driver Side',
    'Front Photo',
    'Dashboard',
  ];
  final List<File?> _photoFiles = List.filled(5, null);
  final List<String?> _photoUrls = List.filled(5, null);
  final List<bool> _uploading = List.filled(5, false);

  @override
  void initState() {
    super.initState();
    _fetchLastMileage();
  }

  Future<void> _fetchLastMileage() async {
    if (widget.route.van.isEmpty) return;
    final repo = ref.read(inspectionRepositoryProvider);
    final m = await repo.getLastMileage(widget.route.van);
    if (m != null && mounted) {
      setState(() {
        _lastMileage = m;
        if (_mileageCtrl.text.isEmpty) _mileageCtrl.text = '$m';
      });
    }
  }

  Future<void> _pickPhoto(int index) async {
    final picker = ImagePicker();
    final xFile = await picker.pickImage(
      source: ImageSource.camera,
      maxWidth: 1200,
      imageQuality: 80,
    );
    if (xFile == null) return;
    final file = File(xFile.path);
    setState(() {
      _photoFiles[index] = file;
      _uploading[index] = true;
    });

    final repo = ref.read(inspectionRepositoryProvider);
    final url = await repo.uploadPhoto(file);
    if (mounted) {
      setState(() {
        _photoUrls[index] = url;
        _uploading[index] = false;
      });
    }
  }

  Future<void> _submit() async {
    final mileage = int.tryParse(_mileageCtrl.text.trim());
    if (mileage == null || mileage <= 0) {
      _showSnack('Please enter a valid mileage');
      return;
    }

    setState(() => _saving = true);
    try {
      final repo = ref.read(inspectionRepositoryProvider);
      final data = <String, dynamic>{
        'routeId': widget.route.id,
        'driver': widget.route.transporterId,
        'employeeName': widget.route.employeeName,
        'van': widget.route.van,
        'vin': widget.route.vin,
        'routeDate': widget.route.date?.toIso8601String() ?? '',
        'mileage': mileage,
        'comments': _commentsCtrl.text.trim(),
        'anyRepairs': _anyRepairs ? 'TRUE' : 'FALSE',
        if (_anyRepairs) 'repairDescription': _repairDescCtrl.text.trim(),
        if (_anyRepairs) 'repairCurrentStatus': 'Not Started',
        // Photos — always send all fields
        'vehiclePicture1': _photoUrls[0],
        'vehiclePicture2': _photoUrls[1],
        'vehiclePicture3': _photoUrls[2],
        'vehiclePicture4': _photoUrls[3],
        'dashboardImage': _photoUrls[4],
      };

      await repo.submitInspection(data);

      if (mounted) {
        // Invalidate the routes provider so the card updates
        final param = RoutesParam(
          yearWeek: dateToYearWeek(widget.route.date ?? DateTime.now()),
          date: widget.route.date != null ? isoDate(widget.route.date!) : null,
        );
        ref.invalidate(myRoutesProvider(param));

        _showSnack('Inspection submitted ✓', isError: false);
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      _showSnack('Failed to submit: $e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _showSnack(String msg, {bool isError = true}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg, style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
        backgroundColor: isError ? AppTheme.errorRed : AppTheme.accentEmerald,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  @override
  void dispose() {
    _mileageCtrl.dispose();
    _commentsCtrl.dispose();
    _repairDescCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: isDark ? AppTheme.surfaceDark : Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          'Route Inspection',
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
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Mileage ──
          _buildMileageField(theme, isDark),
          const SizedBox(height: 16),

          // ── Photos ──
          _buildPhotosSection(theme, isDark),
          const SizedBox(height: 16),

          // ── Any Repairs ──
          _buildRepairsSection(theme, isDark),
          const SizedBox(height: 16),

          // ── Comments ──
          _buildField('Comments (optional)', _commentsCtrl, theme, isDark,
              maxLines: 3),
          const SizedBox(height: 28),

          // ── Submit Button ──
          _buildSubmitButton(isDark),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildRouteHeader(ThemeData theme, bool isDark, Color typeColor) {
    final r = widget.route;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.cardDark : Colors.grey.shade50,
        borderRadius: BorderRadius.circular(14),
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
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: typeColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: typeColor.withValues(alpha: 0.3)),
                ),
                child: Text(
                  r.type.isNotEmpty ? r.type : '—',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: typeColor,
                  ),
                ),
              ),
              const Spacer(),
              if (r.routeNumber.isNotEmpty)
                Text(
                  '#${r.routeNumber}',
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: theme.textTheme.bodyLarge?.color,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              if (r.van.isNotEmpty) _chip(Icons.local_shipping_outlined, r.van, theme),
              if (r.waveTime.isNotEmpty)
                _chip(Icons.waves_outlined, r.waveTime, theme),
              if (r.stopCount > 0)
                _chip(Icons.pin_drop_outlined, '${r.stopCount} stops', theme),
              if (r.packageCount > 0)
                _chip(Icons.inventory_2_outlined, '${r.packageCount} pkg', theme),
            ],
          ),
        ],
      ),
    );
  }

  Widget _chip(IconData icon, String label, ThemeData theme) {
    final isDark = theme.brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withValues(alpha: 0.05)
            : Colors.black.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: theme.textTheme.bodySmall?.color),
          const SizedBox(width: 4),
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: theme.textTheme.bodySmall?.color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMileageField(ThemeData theme, bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              'Mileage *',
              style: GoogleFonts.inter(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: theme.textTheme.bodyLarge?.color,
              ),
            ),
            if (_lastMileage != null) ...[
              const SizedBox(width: 8),
              Text(
                'Last: ${_lastMileage!.toStringAsFixed(0)}',
                style: GoogleFonts.inter(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: AppTheme.accentEmerald,
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            _stepButton(Icons.remove, () {
              final v = (int.tryParse(_mileageCtrl.text) ?? 0) - 1;
              if (v >= 0) _mileageCtrl.text = '$v';
            }, isDark),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: _mileageCtrl,
                keyboardType: TextInputType.number,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: isDark
                      ? Colors.white.withValues(alpha: 0.05)
                      : Colors.grey.shade100,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ),
            const SizedBox(width: 8),
            _stepButton(Icons.add, () {
              final v = (int.tryParse(_mileageCtrl.text) ?? 0) + 1;
              _mileageCtrl.text = '$v';
            }, isDark),
          ],
        ),
      ],
    );
  }

  Widget _stepButton(IconData icon, VoidCallback onTap, bool isDark) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44,
        height: 48,
        decoration: BoxDecoration(
          color: isDark
              ? Colors.white.withValues(alpha: 0.06)
              : Colors.grey.shade200,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, size: 20),
      ),
    );
  }

  Widget _buildPhotosSection(ThemeData theme, bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.camera_alt_outlined,
                size: 16, color: theme.textTheme.bodySmall?.color),
            const SizedBox(width: 6),
            Text(
              'Photos',
              style: GoogleFonts.inter(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: theme.textTheme.bodyLarge?.color,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '${_photoUrls.where((u) => u != null).length}/5',
              style: GoogleFonts.inter(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppTheme.accentEmerald,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        // Row 1: 3 photos
        Row(
          children: [
            for (int i = 0; i < 3; i++) ...[
              if (i > 0) const SizedBox(width: 10),
              Expanded(child: _photoSlot(i, isDark, theme)),
            ],
          ],
        ),
        const SizedBox(height: 10),
        // Row 2: 2 photos
        Row(
          children: [
            for (int i = 3; i < 5; i++) ...[
              if (i > 3) const SizedBox(width: 10),
              Expanded(child: _photoSlot(i, isDark, theme)),
            ],
            const SizedBox(width: 10),
            // Spacer to match row width with top row
            const Expanded(child: SizedBox()),
          ],
        ),
      ],
    );
  }

  Widget _photoSlot(int i, bool isDark, ThemeData theme) {
    final file = _photoFiles[i];
    final url = _photoUrls[i];
    final isUploading = _uploading[i];

    return GestureDetector(
      onTap: isUploading ? null : () => _pickPhoto(i),
      child: Container(
        height: 110,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: url != null
                ? AppTheme.accentEmerald.withValues(alpha: 0.5)
                : (isDark ? AppTheme.dividerDark : AppTheme.dividerLight),
            width: url != null ? 2 : 1,
          ),
          color: isDark
              ? Colors.white.withValues(alpha: 0.04)
              : Colors.grey.shade100,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (file != null)
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(11),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      Image.file(file, fit: BoxFit.cover),
                      if (isUploading)
                        Container(
                          color: Colors.black54,
                          child: const Center(
                            child: SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                      if (url != null && !isUploading)
                        Positioned(
                          top: 4,
                          right: 4,
                          child: Container(
                            padding: const EdgeInsets.all(2),
                            decoration: const BoxDecoration(
                              color: AppTheme.accentEmerald,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.check,
                                size: 10, color: Colors.white),
                          ),
                        ),
                    ],
                  ),
                ),
              )
            else ...[
              Icon(
                Icons.add_a_photo_outlined,
                size: 22,
                color: theme.textTheme.bodySmall?.color?.withValues(alpha: 0.4),
              ),
              const SizedBox(height: 4),
              Text(
                _photoLabels[i],
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 9,
                  fontWeight: FontWeight.w500,
                  color:
                      theme.textTheme.bodySmall?.color?.withValues(alpha: 0.5),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildRepairsSection(ThemeData theme, bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              'Any Repairs Needed?',
              style: GoogleFonts.inter(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: theme.textTheme.bodyLarge?.color,
              ),
            ),
            const Spacer(),
            Switch.adaptive(
              value: _anyRepairs,
              activeColor: AppTheme.errorRed,
              onChanged: (v) => setState(() => _anyRepairs = v),
            ),
          ],
        ),
        if (_anyRepairs) ...[
          const SizedBox(height: 8),
          _buildField('Repair Description', _repairDescCtrl, theme, isDark,
              maxLines: 3),
        ],
      ],
    );
  }

  Widget _buildField(
    String label,
    TextEditingController ctrl,
    ThemeData theme,
    bool isDark, {
    int maxLines = 1,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: theme.textTheme.bodySmall?.color,
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: ctrl,
          maxLines: maxLines,
          style: GoogleFonts.inter(fontSize: 14),
          decoration: InputDecoration(
            filled: true,
            fillColor: isDark
                ? Colors.white.withValues(alpha: 0.05)
                : Colors.grey.shade100,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          ),
        ),
      ],
    );
  }

  Widget _buildSubmitButton(bool isDark) {
    return SizedBox(
      width: double.infinity,
      height: 54,
      child: ElevatedButton(
        onPressed: _saving ? null : _submit,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppTheme.primaryIndigo,
          disabledBackgroundColor:
              AppTheme.primaryIndigo.withValues(alpha: 0.4),
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          elevation: 0,
        ),
        child: _saving
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  color: Colors.white,
                ),
              )
            : Text(
                'Submit Inspection',
                style: GoogleFonts.inter(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
      ),
    );
  }
}
