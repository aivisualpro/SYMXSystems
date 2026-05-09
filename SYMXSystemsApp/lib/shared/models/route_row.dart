/// Lightweight DTO for a single driver route record returned by
/// the `/api/mobile/my-routes` endpoint.
///
/// Field names mirror the backend JSON keys exactly so
/// [RouteRow.fromJson] is a direct 1-to-1 mapping.
class RouteRow {
  final String id;
  final String transporterId;
  final DateTime? date;
  final String weekDay;
  final String employeeName;
  final String type;
  final String typeColor;
  final String typeIcon;
  final String routeNumber;
  final String van;
  final String routeDuration;
  final String waveTime;
  final String inspectionTime;
  final String inspectionId;
  final String actualDepartureTime;
  final String deliveryCompletionTime;
  final String profileImage;
  final int stopCount;
  final int packageCount;
  final String attendance;
  final String serviceType;

  const RouteRow({
    required this.id,
    required this.transporterId,
    this.date,
    this.weekDay = '',
    this.employeeName = '',
    this.type = '',
    this.typeColor = '#6B7280',
    this.typeIcon = '',
    this.routeNumber = '',
    this.van = '',
    this.routeDuration = '',
    this.waveTime = '',
    this.inspectionTime = '',
    this.inspectionId = '',
    this.actualDepartureTime = '',
    this.deliveryCompletionTime = '',
    this.profileImage = '',
    this.stopCount = 0,
    this.packageCount = 0,
    this.attendance = '',
    this.serviceType = '',
  });

  factory RouteRow.fromJson(Map<String, dynamic> json) {
    DateTime? parsedDate;
    final rawDate = json['date'];
    if (rawDate is String && rawDate.isNotEmpty) {
      parsedDate = DateTime.tryParse(rawDate);
    }

    return RouteRow(
      id: json['id'] ?? json['_id'] ?? '',
      transporterId: json['transporterId'] ?? '',
      date: parsedDate,
      weekDay: json['weekDay'] ?? '',
      employeeName: json['employeeName'] ?? '',
      type: json['type'] ?? '',
      typeColor: json['typeColor'] ?? '#6B7280',
      typeIcon: json['typeIcon'] ?? '',
      routeNumber: json['routeNumber'] ?? '',
      van: json['van'] ?? '',
      routeDuration: json['routeDuration'] ?? '',
      waveTime: json['waveTime'] ?? '',
      inspectionTime: json['inspectionTime'] ?? '',
      inspectionId: json['inspectionId'] ?? '',
      actualDepartureTime: json['actualDepartureTime'] ?? '',
      deliveryCompletionTime: json['deliveryCompletionTime'] ?? '',
      profileImage: json['profileImage'] ?? '',
      stopCount: json['stopCount'] ?? 0,
      packageCount: json['packageCount'] ?? 0,
      attendance: json['attendance'] ?? '',
      serviceType: json['serviceType'] ?? '',
    );
  }

  /// Whether this route has been inspected (both time and ID present).
  bool get isInspected =>
      inspectionTime.trim().isNotEmpty && inspectionId.isNotEmpty;
}
