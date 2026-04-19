# TECHNICAL AUDIT DATA PACK

## 1. ROUTES AND PAGES
| Route | File | Query Params | Composables | API Endpoints Called |
|---|---|---|---|---|
| / | `app/page.tsx` | No | None | None |
| /apply | `app/apply/page.tsx` | No | useState<br>useEffect | /api/public/interview |
| /submit-ticket | `app/submit-ticket/page.tsx` | No | useState<br>useEffect | /api/public/hr-ticket |
| /confirm/[token] | `app/confirm/[token]/page.tsx` | No | useState<br>useEffect | /api/public/confirm/${token} |
| /owner | `app/(protected)/owner/page.tsx` | No | None | None |
| /owner/app-users | `app/(protected)/owner/app-users/page.tsx` | No | useState<br>useEvent<br>useMemo<br>useOwner<br>useCallback | /api/admin/users/${editingItem._id}<br>/api/auth/change-password<br>/api/admin/users/${id}<br>/api/admin/users/${userId}<br>/api/admin/users/${item._id}<br>/api/admin/users |
| /owner/app-users/[id] | `app/(protected)/owner/app-users/[id]/page.tsx` | No | useState<br>useParams<br>useEffect<br>useRouter<br>useHeaderActions | /api/auth/change-password<br>/api/admin/users/${id} |
| /owner/roles | `app/(protected)/owner/roles/page.tsx` | No | useState<br>useRef<br>useDataStore<br>useEffect<br>useRouter<br>useEvent<br>useEffects<br>useHeaderActions | /api/admin/roles/${roleToDelete._id}<br>/api/admin/roles |
| /owner/roles/[id] | `app/(protected)/owner/roles/[id]/page.tsx` | No | useState<br>useParams<br>useEffect<br>useRouter<br>useHeaderActions | /api/admin/roles/${roleId}<br>/api/admin/modules |
| /scheduling | `app/(protected)/scheduling/page.tsx` | Yes | useState<br>useRef<br>usePathname<br>useEffect<br>useDataStore<br>useRouter<br>useMemo<br>useHeaderActions<br>useCallback<br>useSearchParams | /api/schedules/reset-week<br>/api/schedules/generate<br>/api/everyday<br>/api/admin/settings/route-types<br>/api/user/profile<br>/api/schedules/notes<br>/api/schedules/audit<br>/api/schedules |
| /scheduling/messaging | `app/(protected)/scheduling/messaging/page.tsx` | Yes | useSearchParams<br>useRouter<br>useEffect | None |
| /scheduling/messaging/[tab] | `app/(protected)/scheduling/messaging/[tab]/page.tsx` | No | None | None |
| /admin/settings | `app/(protected)/admin/settings/page.tsx` | No | None | None |
| /admin/settings/general | `app/(protected)/admin/settings/general/page.tsx` | No | None | None |
| /admin/settings/general/general | `app/(protected)/admin/settings/general/general/page.tsx` | No | useState<br>useRef<br>useEffect<br>useEvent<br>useCallback | /api/admin/settings/general<br>/api/admin/settings/route-types |
| /admin/settings/general/default-routes | `app/(protected)/admin/settings/general/default-routes/page.tsx` | No | useState<br>useAddRef<br>useSortable<br>useSensor<br>useEffect<br>useSensors<br>useCallback | /api/admin/settings/route-types |
| /admin/settings/general/wst | `app/(protected)/admin/settings/general/wst/page.tsx` | No | useCallback<br>useState<br>useAddRef<br>useEffect | /api/admin/settings/wst |
| /admin/settings/general/dropdowns | `app/(protected)/admin/settings/general/dropdowns/page.tsx` | No | useState<br>useAddRef<br>useCircle<br>useEffect<br>useMemo<br>useCallback | /api/admin/settings/dropdowns |
| /admin/settings/imports | `app/(protected)/admin/settings/imports/page.tsx` | No | useState<br>useRef | /api/dispatching/routes/import<br>/api/admin/imports |
| /admin/users | `app/(protected)/admin/users/page.tsx` | No | useState<br>useRef<br>useDataStore<br>useEffect<br>useRouter | /api/admin/users/${editingItem._id}<br>/api/admin/users/${row.original._id}<br>/api/admin/users/${id}<br>/api/admin/users/${item._id}<br>/api/admin/users |
| /admin/users/[id] | `app/(protected)/admin/users/[id]/page.tsx` | No | useState<br>useParams<br>useEffect<br>useRouter<br>useHeaderActions | /api/auth/change-password<br>/api/admin/users/${id} |
| /admin/notifications | `app/(protected)/admin/notifications/page.tsx` | No | useHeaderActions<br>useState<br>useEffect | /api/admin/notifications |
| /dashboard | `app/(protected)/dashboard/page.tsx` | No | None | None |
| /profile | `app/(protected)/profile/page.tsx` | No | useState<br>useRef<br>useEffect<br>useHeaderActions<br>useCallback | /api/auth/change-password<br>/api/user/profile |
| /hr | `app/(protected)/hr/page.tsx` | No | useState<br>useRef<br>useEffect<br>useDataStore<br>useRouter<br>useMemo | /api/admin/reimbursements<br>/api/admin/claims<br>/api/admin/employees/dashboard |
| /hr/tickets | `app/(protected)/hr/tickets/page.tsx` | No | useState<br>useRef<br>useEffect<br>useDataStore<br>useMemo<br>useHeaderActions<br>useCallback | /api/admin/hr-tickets/${ticketId}<br>/api/admin/imports<br>/api/admin/hr-tickets/${ticket._id}<br>/api/admin/hr-tickets |
| /hr/terminations | `app/(protected)/hr/terminations/page.tsx` | No | useState<br>useRef<br>useDataStore<br>useEffect<br>useRouter<br>useMemo | /api/admin/employees |
| /hr/uniforms | `app/(protected)/hr/uniforms/page.tsx` | No | None | None |
| /hr/audit | `app/(protected)/hr/audit/page.tsx` | No | useState<br>useRef<br>useEffect<br>useDataStore<br>useRouter<br>useMemo<br>useHeaderActions<br>useCallback | /api/admin/employees<br>/api/admin/employees/${empId}<br>/api/admin/upload<br>/api/admin/employees/${previewEmpId} |
| /hr/timesheet | `app/(protected)/hr/timesheet/page.tsx` | No | useState<br>useDataStore<br>useEffect<br>useHeaderActions<br>useCallback | /api/admin/employees |
| /hr/[id] | `app/(protected)/hr/[id]/page.tsx` | No | useHeaderActions<br>useState<br>useRouter<br>useEffect | /api/fleet<br>/api/admin/employees/${employee._id}<br>/api/admin/employees/${params.id} |
| /hr/interviews | `app/(protected)/hr/interviews/page.tsx` | No | useState<br>useRef<br>useEffect<br>useDataStore<br>useMemo<br>useHeaderActions<br>useCallback | /api/admin/interviews/${id}<br>/api/admin/interviews<br>/api/admin/upload<br>/api/admin/settings/dropdowns<br>/api/admin/interviews/${interview._id}<br>/api/admin/imports |
| /hr/incidents | `app/(protected)/hr/incidents/page.tsx` | No | useState<br>useRef<br>useEffect<br>useDataStore<br>useMemo<br>useHeaderActions<br>useCallback | /api/admin/claims/${id}<br>/api/admin/claims<br>/api/admin/settings/dropdowns<br>/api/admin/employees<br>/api/admin/imports<br>/api/admin/claims/${editingItem._id} |
| /hr/reimbursement | `app/(protected)/hr/reimbursement/page.tsx` | No | useState<br>useRef<br>useEffect<br>useDataStore<br>useMemo<br>useHeaderActions<br>useCallback | /api/admin/reimbursements/${id}<br>/api/admin/employees<br>/api/admin/reimbursements<br>/api/admin/reimbursements/${editingItem._id}<br>/api/admin/imports |
| /hr/employees | `app/(protected)/hr/employees/page.tsx` | Yes | useState<br>useCircle<br>useRef<br>useEffect<br>useDataStore<br>useRouter<br>useMemo<br>useSearchParams | /api/admin/employees<br>/api/admin/employees/${editingItem._id}<br>/api/admin/employees/${id} |
| /dispatching | `app/(protected)/dispatching/page.tsx` | No | None | None |
| /dispatching/attendance | `app/(protected)/dispatching/attendance/page.tsx` | No | useState<br>useDispatching<br>useRef<br>useEffect<br>useDataStore<br>useEvent<br>useMemo<br>useCallback | /api/dispatching/routes |
| /dispatching/efficiency | `app/(protected)/dispatching/efficiency/page.tsx` | No | useState<br>useDispatching<br>useEffect<br>useDataStore<br>useMemo<br>useHeaderActions<br>useCallback | /api/dispatching/routes |
| /dispatching/roster | `app/(protected)/dispatching/roster/page.tsx` | No | useState<br>useDispatching<br>useEffect<br>useDataStore<br>useMemo<br>useCallback | /api/schedules/audit<br>/api/dispatching/routes |
| /dispatching/opening | `app/(protected)/dispatching/opening/page.tsx` | No | useState<br>useDispatching<br>useEffect<br>useDataStore<br>useMemo<br>useCallback | /api/dispatching/routes |
| /dispatching/repairs | `app/(protected)/dispatching/repairs/page.tsx` | No | None | None |
| /dispatching/time | `app/(protected)/dispatching/time/page.tsx` | No | useState<br>useDispatching<br>useRef<br>useEffect<br>useDataStore<br>useMemo<br>useCallback | /api/dispatching/routes |
| /dispatching/closing | `app/(protected)/dispatching/closing/page.tsx` | Yes | useState<br>useDispatching<br>useRef<br>useEffect<br>useDataStore<br>useRouter<br>useMemo<br>useCallback<br>useSearchParams | None |
| /dispatching/routes | `app/(protected)/dispatching/routes/page.tsx` | No | useState<br>useDispatching<br>useRef<br>useEffect<br>useDataStore<br>useMemo<br>useCallback | /api/dispatching/confirmation-status<br>/api/dispatching/routes<br>/api/schedules/audit |
| /load-out | `app/(protected)/load-out/page.tsx` | No | useState<br>useDispatching<br>useRef<br>useEffect<br>useDataStore<br>useMemo<br>useCallback | /api/dispatching/confirmation-status<br>/api/dispatching/routes<br>/api/schedules/audit |
| /everyday | `app/(protected)/everyday/page.tsx` | No | useState<br>useEffect<br>useMemo<br>useHeaderActions<br>useCallback | /api/dispatching/routes<br>/api/everyday<br>/api/admin/settings/route-types<br>/api/everyday/rts<br>/api/everyday/schedules<br>/api/admin/employees<br>/api/everyday/rescue |
| /fleet | `app/(protected)/fleet/page.tsx` | No | useRouter<br>useFleet | None |
| /fleet/rentals | `app/(protected)/fleet/rentals/page.tsx` | No | useState<br>useMemo<br>useFleet | None |
| /fleet/repairs | `app/(protected)/fleet/repairs/page.tsx` | No | useState<br>useFleet<br>useRef<br>useEffect<br>useDataStore<br>useMemo<br>useHeaderActions<br>useCallback | /api/fleet |
| /fleet/inspections | `app/(protected)/fleet/inspections/page.tsx` | Yes | useState<br>useFleet<br>useRef<br>useEffect<br>useRouter<br>useMemo<br>useHeaderActions<br>useCallback<br>useSearchParams | /api/fleet |
| /fleet/inspections/[id] | `app/(protected)/fleet/inspections/[id]/page.tsx` | Yes | useState<br>useFleet<br>useParams<br>useRef<br>useEffect<br>useRouter<br>useHeaderActions<br>useCallback<br>useSearchParams | /api/fleet |
| /fleet/vehicles | `app/(protected)/fleet/vehicles/page.tsx` | No | useState<br>useFleet<br>useRef<br>useEffect<br>useRouter<br>useMemo<br>useCallback | None |
| /fleet/vehicles/[id] | `app/(protected)/fleet/vehicles/[id]/page.tsx` | No | useState<br>useRouter<br>useEffect | /api/fleet/vehicles/${vehicleId}/rentals<br>/api/admin/settings/dropdowns<br>/api/fleet/vehicles/${vehicleId}/communications<br>/api/fleet/vehicles/${id} |
| /scorecard | `app/(protected)/scorecard/page.tsx` | No | None | None |
| /scorecard/[tab] | `app/(protected)/scorecard/[tab]/page.tsx` | Yes | useState<br>useParams<br>useRef<br>useEffect<br>useRouter<br>useMemo<br>useHeaderActions<br>useCallback<br>useSearchParams | /api/scorecard/scorecard-remarks<br>/api/scorecard/delete-week<br>/api/scorecard/employee-performance<br>/api/admin/imports<br>/api/auth/session |
| /c/[token] | `app/c/[token]/page.tsx` | No | useState<br>useEffect | /api/public/confirm/${token} |
| /login | `app/login/page.tsx` | No | useState<br>useRouter<br>useEffect | /api/auth/forgot-password<br>/api/auth/login |

## 2. TAB LOGIC
*Note: No 'leads' module was found in the codebase. Business logic tabs exist for other modules as follows:*

| Module | Tabs | Labels | Business Logic inferred |
|---|---|---|---|
| app/(protected)/owner/layout.tsx | roles<br>app-users | Roles & Permissions<br>App Users | Standard routing and layout wrapper. |
| app/(protected)/admin/settings/general/layout.tsx | dropdowns<br>default-routes<br>wst<br>general | Dropdowns<br>Default Routes<br>WST<br>General | Standard routing and layout wrapper. |
| app/(protected)/hr/layout.tsx | audit<br>dashboard<br>timesheet<br>employees<br>reimbursement<br>tickets<br>uniforms<br>terminations<br>incidents<br>interviews | Employee Audit<br>Dashboard<br>Timesheet<br>Employees<br>Reimbursement<br>HR Tickets<br>Uniforms<br>Terminations<br>Incidents<br>Interviews | Standard routing and layout wrapper. |
| app/(protected)/dispatching/layout.tsx | closing<br>attendance<br>time<br>efficiency<br>routes | Closing<br>Attendance<br>Time<br>Efficiency<br>Routes | Standard routing and layout wrapper. |
| app/(protected)/load-out/layout.tsx | closing<br>attendance<br>time<br>efficiency<br>routes | Closing<br>Attendance<br>Time<br>Efficiency<br>Routes | Standard routing and layout wrapper. |
| app/(protected)/fleet/layout.tsx | rentals<br>inspections<br>vehicles<br>repairs<br>overview | Rental Agreements<br>Inspections<br>Vehicles<br>Repairs<br>Overview | Standard routing and layout wrapper. |

## 3. API INVENTORY
| Endpoint Path | Methods | Auth | Models Touched |
|---|---|---|---|
| `/api/auth/logout` | POST | No/Implicit | None |
| `/api/auth/forgot-password` | POST | No/Implicit | SymxUser |
| `/api/auth/change-password` | POST | No/Implicit | SymxUser |
| `/api/auth/login` | POST | No/Implicit | SymxUser |
| `/api/auth/session` | GET | No/Implicit | SymxUser |
| `/api/admin/settings/general` | GET, POST | No/Implicit | SYMXSetting |
| `/api/admin/settings/route-types` | GET, POST, PATCH, DELETE | No/Implicit | RouteType |
| `/api/admin/settings/wst` | GET, POST, DELETE | No/Implicit | SYMXWSTOption |
| `/api/admin/settings/dropdowns` | GET, POST, DELETE | No/Implicit | DropdownOption |
| `/api/admin/roles` | GET, POST | No/Implicit | SymxAppRole<br>SymxUser |
| `/api/admin/roles/[id]` | GET, PUT, DELETE | No/Implicit | SymxAppRole |
| `/api/admin/reimbursements` | GET, POST | No/Implicit | SymxReimbursement<br>SymxEmployee |
| `/api/admin/reimbursements/[id]` | PUT, DELETE | No/Implicit | SymxReimbursement |
| `/api/admin/imports` | POST | No/Implicit | SymxReimbursement<br>Vehicle<br>ScoreCardRTS<br>SymxPhotoOnDelivery<br>DailyInspection<br>SymxDVICVehicleInspection<br>ScoreCardQualityDSBDNR<br>ScoreCardCDFNegative<br>DropdownOption<br>VehicleRentalAgreement<br>SymxEmployeeSchedule<br>ScoreCardDCR<br>SymxInterview<br>VehicleRepair<br>SymxAvailableWeek<br>SymxDeliveryExcellence<br>SymxHrTicket<br>SymxSafetyDashboardDFO2<br>SymxIncident<br>SymxEmployee |
| `/api/admin/users` | GET, POST | No/Implicit | SymxUser |
| `/api/admin/users/[id]` | GET, PUT, DELETE | No/Implicit | SymxUser |
| `/api/admin/modules` | GET, POST | No/Implicit | SymxAppModule |
| `/api/admin/migrate-images` | POST | No/Implicit | SymxUser |
| `/api/admin/interviews` | GET, POST | No/Implicit | SymxInterview |
| `/api/admin/interviews/[id]` | GET, PUT, DELETE | No/Implicit | SymxInterview |
| `/api/admin/notifications` | GET | No/Implicit | SymxNotification |
| `/api/admin/hr-tickets` | GET, POST | No/Implicit | SymxHrTicket<br>SymxEmployee<br>SymxUser |
| `/api/admin/hr-tickets/[id]` | GET, PUT, DELETE | No/Implicit | SymxHrTicket |
| `/api/admin/upload` | POST | No/Implicit | None |
| `/api/admin/claims` | GET, POST | No/Implicit | SymxIncident<br>SymxEmployee |
| `/api/admin/claims/[id]` | PUT, DELETE | No/Implicit | SymxIncident |
| `/api/admin/employees` | GET, POST | No/Implicit | SymxEmployee |
| `/api/admin/employees/dashboard` | GET | No/Implicit | SymxEmployee |
| `/api/admin/employees/[id]` | GET, PUT, DELETE | No/Implicit | SymxEmployee |
| `/api/user/permissions` | GET | No/Implicit | SymxAppRole<br>SymxAppModule<br>SymxUser |
| `/api/user/profile` | GET, PUT | No/Implicit | SymxUser |
| `/api/schedules` | GET, PATCH | No/Implicit | SymxEmployeeSchedule<br>RouteType<br>SYMXRoute<br>ScheduleAuditLog<br>SymxUser<br>SymxEmployee |
| `/api/schedules/reset-week` | DELETE | No/Implicit | SYMXRoutesInfo<br>SymxEmployeeSchedule<br>ScheduleAuditLog<br>SYMXRoute |
| `/api/schedules/notes` | GET, POST | No/Implicit | SymxEmployeeNote<br>SymxUser |
| `/api/schedules/notes/[id]` | PUT, DELETE | No/Implicit | SymxEmployeeNote |
| `/api/schedules/audit` | GET, POST | No/Implicit | ScheduleAuditLog<br>SymxUser |
| `/api/schedules/generate` | POST | No/Implicit | SymxAvailableWeek<br>SymxEmployeeSchedule<br>SymxEmployee |
| `/api/dashboard/revenue-cost` | GET | No/Implicit | SYMXRoute |
| `/api/public/hr-ticket` | POST | No/Implicit | SymxHrTicket |
| `/api/public/migrate-repair-images` | GET | No/Implicit | VehicleRepair |
| `/api/public/confirm/[token]` | GET, POST | No/Implicit | ScheduleConfirmation<br>SymxEmployeeSchedule<br>MessageLog |
| `/api/public/interview` | POST | No/Implicit | SymxInterview |
| `/api/public/extension-sync` | POST, OPTIONS | No/Implicit | SYMXRoute<br>SymxEmployee<br>SYMXRoutesInfo |
| `/api/dispatching/confirmation-status` | PUT | No/Implicit | ScheduleConfirmation |
| `/api/dispatching/routes` | GET, POST, PUT | No/Implicit | SymxEmployeeSchedule<br>Vehicle<br>SYMXRoutesInfo<br>RouteType<br>SYMXRoute<br>ScheduleAuditLog<br>SymxUser<br>ScheduleConfirmation<br>SYMXSetting<br>SymxEmployee |
| `/api/dispatching/routes/[id]` | GET | No/Implicit | SYMXRoute |
| `/api/dispatching/routes/import` | POST | No/Implicit | SYMXRoutesInfo<br>SYMXRoute |
| `/api/dispatching/routes-info` | GET, POST, PUT | No/Implicit | SYMXWSTOption<br>SYMXRoutesInfo<br>SYMXRoute<br>DropdownOption<br>SymxEmployee |
| `/api/everyday` | GET, POST | No/Implicit | None |
| `/api/everyday/rts` | GET, POST, DELETE | No/Implicit | SYMXRTS |
| `/api/everyday/rescue` | GET, POST, DELETE | No/Implicit | SYMXRescue |
| `/api/everyday/schedules` | PUT, GET | No/Implicit | SymxEmployeeSchedule |
| `/api/card-config` | GET, PUT | No/Implicit | SymxCardConfig<br>SymxAppModule |
| `/api/fleet` | GET, POST, PUT, DELETE, PATCH | No/Implicit | Vehicle<br>VehicleActivityLog<br>SYMXRoute<br>VehicleRepair<br>DropdownOption<br>VehicleInspection<br>SymxUser<br>DailyInspection<br>VehicleRentalAgreement<br>SymxEmployee |
| `/api/fleet/vehicles/[id]` | GET | No/Implicit | Vehicle<br>VehicleActivityLog<br>VehicleRepair<br>VehicleInspection<br>SymxUser<br>DailyInspection<br>VehicleRentalAgreement<br>SymxEmployee |
| `/api/fleet/vehicles/[id]/rentals` | POST, PUT, DELETE | No/Implicit | Vehicle<br>VehicleRentalAgreement |
| `/api/fleet/vehicles/[id]/communications` | POST, PUT, DELETE | No/Implicit | Vehicle |
| `/api/messaging/webhook` | POST, GET | No/Implicit | SymxEmployeeSchedule<br>SymxEmployee<br>MessageLog |
| `/api/messaging/phone-numbers` | GET | No/Implicit | None |
| `/api/messaging/history` | GET | No/Implicit | ScheduleConfirmation<br>MessageLog |
| `/api/messaging/templates` | GET, PUT, POST | No/Implicit | MessagingTemplate |
| `/api/messaging/send` | POST | No/Implicit | ScheduleConfirmation<br>SymxEmployeeSchedule<br>MessageLog |
| `/api/messaging/live-status` | GET | No/Implicit | ScheduleConfirmation<br>MessageLog |
| `/api/messaging/upload` | POST | No/Implicit | None |
| `/api/messaging/employees` | GET | No/Implicit | SymxEmployeeSchedule<br>SYMXRoute<br>ScheduleConfirmation<br>SymxEmployee<br>MessageLog |
| `/api/scorecard/employee-performance` | GET | No/Implicit | SymxDVICVehicleInspection<br>ScoreCardQualityDSBDNR<br>ScoreCardCDFNegative<br>ScoreCardDCR<br>ScoreCardRTS<br>SymxPhotoOnDelivery<br>SymxSafetyDashboardDFO2<br>SymxDeliveryExcellence<br>SymxEmployee |
| `/api/scorecard/delete-week` | DELETE | No/Implicit | SymxDVICVehicleInspection<br>ScoreCardQualityDSBDNR<br>ScoreCardCDFNegative<br>ScoreCardDCR<br>ScoreCardRTS<br>SymxPhotoOnDelivery<br>SymxSafetyDashboardDFO2<br>SymxDeliveryExcellence |
| `/api/scorecard/scorecard-remarks` | GET, PUT | No/Implicit | SymxScoreCardRemarks |
| `/api/searates` | GET | No/Implicit | None |

## 4. DATABASE SCHEMAS
### DailyInspection
**Fields:**
- `routeId: type: String, default: '', index: true`
- `driver: type: String, default: ''`
- `routeDate: type: Date, index: true`
- `timeStamp: type: Date`
- `inspectedBy: type: String, default: ''`
- `vin: type: String, default: '', index: true`
- `vehicleId: type: Schema.Types.ObjectId, ref: 'Vehicle', index: true`
- `unitNumber: type: String, default: ''`
- `mileage: type: Number, default: 0`
- `vehiclePicture1: type: String, default: ''`
- `vehiclePicture2: type: String, default: ''`
- `vehiclePicture3: type: String, default: ''`
- `vehiclePicture4: type: String, default: ''`
- `dashboardImage: type: String, default: ''`
- `additionalPicture: type: String, default: ''`
- `comments: type: String, default: ''`
- `inspectionType: type: String, default: ''`
- `anyRepairs: type: String, default: ''`
- `repairDescription: type: String, default: ''`
- `repairCurrentStatus: type: String, default: ''`
- `repairEstimatedDate: type: Date`
- `repairImage: type: String, default: ''`
- `isCompared: type: Boolean, default: false`
- `isStandardPhoto: type: Boolean, default: false`
**Indexes:**
- ` routeDate: -1 `
- ` routeId: 1, vin: 1, routeDate: 1 `
- ` vin: 1, routeDate: -1 `
- ` driver: 1 `
- ` inspectedBy: 1 `
- ` unitNumber: 1, routeDate: -1 `
- ` vin: 1, isStandardPhoto: 1 `
- ` vin: 'text', driver: 'text', routeId: 'text', inspectedBy: 'text', comments: 'text' `

### ScoreCardRTS
**Fields:**
- `week: type: String, required: true, index: true`
- `deliveryAssociate: type: String, default: ''`
- `trackingId: type: String, default: ''`
- `transporterId: type: String, index: true`
- `impactDcr: type: String, default: ''`
- `rtsCode: type: String, default: ''`
- `customerContactDetails: type: String, default: ''`
- `plannedDeliveryDate: type: String, default: ''`
- `exemptionReason: type: String, default: ''`
- `serviceArea: type: String, default: ''`
- `employeeId: type: Schema.Types.ObjectId, ref: 'SymxEmployee'`
**Indexes:**
- ` week: 1, transporterId: 1, trackingId: 1, plannedDeliveryDate: 1 `

### ScoreCardQualityDSBDNR
**Fields:**
- `week: type: String, required: true, index: true`
- `deliveryAssociate: type: String`
- `transporterId: type: String, required: true, index: true`
- `dsbCount: type: Number, default: 0`
- `dsbDpmo: type: Number, default: 0`
- `attendedDeliveryCount: type: Number, default: 0`
- `unattendedDeliveryCount: type: Number, default: 0`
- `simultaneousDeliveries: type: Number, default: 0`
- `deliveredOver50m: type: Number, default: 0`
- `incorrectScanUsageAttended: type: Number, default: 0`
- `incorrectScanUsageUnattended: type: Number, default: 0`
- `noPodOnDelivery: type: Number, default: 0`
- `scannedNotDeliveredNotReturned: type: Number, default: 0`
- `employeeId: type: Schema.Types.ObjectId, ref: 'SymxEmployee'`
**Indexes:**
- ` week: 1, transporterId: 1 `

### ScheduleAuditLog
**Fields:**
- `yearWeek: type: String, required: true`
- `transporterId: type: String, required: true, index: true`
- `employeeName: type: String, default: ''`
- `action: type: String, required: true`
- `field: type: String, required: true`
- `oldValue: type: String, default: ''`
- `newValue: type: String, default: ''`
- `date: type: Date`
- `dayOfWeek: type: String, default: ''`
- `performedBy: type: String, required: true`
- `performedByName: type: String, default: ''`
**Indexes:**
- ` yearWeek: 1, createdAt: -1 `
- ` transporterId: 1, yearWeek: 1 `

### SymxEveryday
**Fields:**
- `date: type: String,       required: true,       unique: true,`
- `notes: type: String,       default: '',`
- `routesAssigned: type: Number,       default: 0,`

### MessagingTemplate
**Fields:**
- `type: type: String,       required: true,       unique: true,       enum: ["future-shift", "shift", "off-tomorrow", "week-schedule", "route-itinerary", "flyer"],`
- `template: type: String,       default: "",`

### RouteType
**Fields:**
- `name: type: String, required: true, unique: true`
- `color: type: String, default: '#6B7280'`
- `startTime: type: String, default: ''`
- `theoryHrs: type: Number, default: 0`
- `group: type: String, enum: ['Operations', 'Driver', 'None'], default: 'None'`
- `routeStatus: type: String, default: 'Scheduled'`
- `icon: type: String, default: ''`
- `sortOrder: type: Number, default: 0`
- `isActive: type: Boolean, default: true`

### SymxCardConfig
**Fields:**
- `index: type: Number, required: true`
- `name: type: String, required: true`
- `bgDark: type: String`
- `bgLight: type: String`
- `page: type: String, required: true, unique: true`
- `cards: type: [CardConfigItemSchema], default: []`
- `updatedBy: type: String`

### SymxAppRole
**Fields:**
- `actions: view: boolean;     create: boolean;     edit: boolean;     delete: boolean;     approve: boolean;     download: boolean;`
- `module: type: String, required: true`
- `actions: view: { type: Boolean, default: true`
- `create: type: Boolean, default: true`
- `edit: type: Boolean, default: true`
- `delete: type: Boolean, default: true`
- `approve: type: Boolean, default: true`
- `download: type: Boolean, default: true`
- `fieldScope: type: Map, of: Boolean`
- `name: type: String, required: true, unique: true`
- `description: type: String`
- `permissions: type: [PermissionSchema], default: []`

### SymxScoreCardRemarks
**Fields:**
- `changedBy: userId: string;     name: string;`
- `transporterId: type: String, required: true`
- `week: type: String, required: true`
- `driverRemarks: type: String, default: ''`
- `driverSignature: type: String, default: ''`
- `driverSignatureTimestamp: type: Date`
- `managerRemarks: type: String, default: ''`
- `managerSignature: type: String, default: ''`
- `managerSignatureTimestamp: type: Date`
- `managerId: type: Schema.Types.ObjectId, ref: 'SymxUser'`
- `managerName: type: String, default: ''`
- `action: type: String, enum: ['created', 'updated'], required: true`
- `changedBy: userId: { type: String, required: true`
- `name: type: String, required: true`
- `changedAt: type: Date, default: Date.now`
**Indexes:**
- ` transporterId: 1, week: 1 `

### ScheduleConfirmation
**Fields:**
- `token: type: String,             required: true,             unique: true,             index: true,             default: () => {                 const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';                 let token = '';                 const bytes = crypto.randomBytes(8);                 for (let i = 0; i < 8; i++) {                     token += chars[bytes[i] % chars.length];`
- `transporterId: type: String, required: true, index: true`
- `employeeName: type: String, default: ""`
- `scheduleDate: type: String`
- `yearWeek: type: String, default: ""`
- `messageType: type: String, required: true`
- `messageLogId: type: Schema.Types.ObjectId, ref: "MessageLog"`
- `status: type: String,             enum: ["pending", "confirmed", "change_requested"],             default: "pending",`
- `confirmedAt: type: Date`
- `changeRequestedAt: type: Date`
- `changeRemarks: type: String`
- `expiresAt: type: Date, required: true, index: true`
**Indexes:**
- ` yearWeek: 1, messageType: 1, messageLogId: 1 `
- ` messageLogId: 1 `

### SymxAppModule
**Fields:**
- `name: type: String, required: true`
- `url: type: String, default: "#"`
- `name: type: String, required: true, unique: true`
- `url: type: String, default: "#"`
- `icon: type: String, default: "IconDashboard"`
- `order: type: Number, default: 0`
- `subModules: type: [SubModuleSchema], default: []`

### SYMXRTS
**Fields:**
- `routeId: type: Schema.Types.ObjectId, ref: "SYMXRoute", required: true`
- `date: type: String, required: true`
- `transporterId: type: String, required: true`
- `tba: type: String, required: true`
- `reason: type: String, required: true`

### SymxIncident
**Fields:**
- `transporterId: type: String, index: true`
- `employeeName: type: String`
- `employeeId: type: Schema.Types.ObjectId, ref: "SymxEmployee"`
- `reportedDate: type: Date`
- `incidentDate: type: Date`
- `claimType: type: String`
- `van: type: String`
- `claimantName: type: String`
- `shortDescription: type: String`
- `claimNumber: type: String`
- `claimantLawyer: type: String`
- `claimStatus: type: String, default: "Open"`
- `statusDetail: type: String`
- `coverageDescription: type: String`
- `claimIncurred: type: String`
- `employeeNotes: type: String`
- `supervisorNotes: type: String`
- `thirdPartyName: type: String`
- `thirdPartyPhone: type: String`
- `thirdPartyEmail: type: String`
- `withInsurance: type: Boolean, default: false`
- `insurancePolicy: type: String`
- `paid: type: Number, default: 0`
- `reserved: type: Number, default: 0`
- `incidentUploadFile: type: String`
- `createdBy: type: String`
**Indexes:**
- ` transporterId: 1, incidentDate: 1 `
- ` claimNumber: 1 `

### SYMXRoute
**Fields:**
- `scheduleId: type: Schema.Types.ObjectId, ref: "SymxEmployeeSchedule"`
- `date: type: Date, required: true`
- `weekDay: type: String, required: true`
- `yearWeek: type: String, required: true`
- `transporterId: type: String, required: true`
- `type: type: String, default: ""`
- `subType: type: String, default: ""`
- `trainingDay: type: String, default: ""`
- `routeSize: type: String, default: ""`
- `van: type: String, default: ""`
- `serviceType: type: String, default: ""`
- `dashcam: type: String, default: ""`
- `routeNumber: type: String, default: ""`
- `stopCount: type: Number, default: 0`
- `packageCount: type: Number, default: 0`
- `routeDuration: type: String, default: ""`
- `waveTime: type: String, default: ""`
- `pad: type: String, default: ""`
- `wst: type: String, default: ""`
- `wstDuration: type: Number, default: 0`
- `wstRevenue: type: Number, default: 0`
- `notes: type: String, default: ""`
- `stagingLocation: type: String, default: ""`
- `extraStops: type: Number, default: 0`
- `stopsRescued: type: Number, default: 0`
- `departureDelay: type: String, default: ""`
- `actualDepartureTime: type: String, default: ""`
- `plannedOutboundStem: type: String, default: ""`
- `actualOutboundStem: type: String, default: ""`
- `outboundDelay: type: String, default: ""`
- `plannedFirstStop: type: String, default: ""`
- `actualFirstStop: type: String, default: ""`
- `firstStopDelay: type: String, default: ""`
- `plannedLastStop: type: String, default: ""`
- `actualLastStop: type: String, default: ""`
- `lastStopDelay: type: String, default: ""`
- `plannedRTSTime: type: String, default: ""`
- `plannedInboundStem: type: String, default: ""`
- `estimatedRTSTime: type: String, default: ""`
- `plannedDuration1stToLast: type: String, default: ""`
- `actualDuration1stToLast: type: String, default: ""`
- `stopsPerHour: type: Number, default: 0`
- `deliveryCompletionTime: type: String, default: ""`
- `dctDelay: type: String, default: ""`
- `driverEfficiency: type: Number, default: 0`
- `attendance: type: String, default: ""`
- `attendanceTime: type: String, default: ""`
- `amazonOutLunch: type: String, default: ""`
- `amazonInLunch: type: String, default: ""`
- `amazonAppLogout: type: String, default: ""`
- `inspectionTime: type: String, default: ""`
- `inspectionId: type: String, default: ""`
- `paycomInDay: type: String, default: ""`
- `paycomOutLunch: type: String, default: ""`
- `paycomInLunch: type: String, default: ""`
- `paycomOutDay: type: String, default: ""`
- `driversUpdatedForLunch: type: String, default: ""`
- `totalHours: type: String, default: ""`
- `regHrs: type: String, default: ""`
- `otHrs: type: String, default: ""`
- `totalCost: type: Number, default: 0`
- `regPay: type: Number, default: 0`
- `otPay: type: Number, default: 0`
- `punchStatus: type: String, default: ""`
- `whc: type: Date`
- `bags: type: String, default: ""`
- `ov: type: String, default: ""`
**Indexes:**
- ` transporterId: 1, date: 1 `
- ` yearWeek: 1 `
- ` transporterId: 1, type: 1 `
- ` van: 1 `
- ` date: 1 `

### SymxEmployeeNote
**Fields:**
- `employeeId: type: Schema.Types.ObjectId, ref: "SymxEmployee", required: true`
- `transporterId: type: String, required: true`
- `note: type: String, required: true`
- `createdBy: type: String, required: true`

### DropdownOption
**Fields:**
- `description: type: String, required: true`
- `type: type: String, required: true, index: true`
- `isActive: type: Boolean, default: true`
- `sortOrder: type: Number, default: 0`
- `image: type: String, default: ''`
- `color: type: String, default: ''`
- `icon: type: String, default: ''`
**Indexes:**
- ` description: 1, type: 1 `

### VehicleRepair
**Fields:**
- `vehicleId: type: Schema.Types.ObjectId, ref: 'Vehicle', index: true`
- `vin: type: String, default: '', index: true`
- `unitNumber: type: String, default: ''`
- `vehicleName: type: String, default: ''`
- `description: type: String, default: ''`
- `currentStatus: type: String,     default: 'Not Started',     index: true`
- `estimatedDate: type: Date`
- `images: type: [String], default: []`
- `completedImages: type: [String], default: []`
- `creationDate: type: Date, default: Date.now`
- `completionDate: type: Date`
- `lastEditOn: type: Date, default: Date.now`
- `repairDuration: type: Number, default: 0`
**Indexes:**
- ` creationDate: -1 `
- ` currentStatus: 1, creationDate: -1 `
- ` unitNumber: 1, creationDate: -1 `
- ` vin: 'text', description: 'text', unitNumber: 'text', currentStatus: 'text' `

### VehicleRentalAgreement
**Fields:**
- `vehicleId: type: Schema.Types.ObjectId, ref: 'Vehicle', index: true`
- `vin: type: String, default: '', index: true`
- `unitNumber: type: String, default: ''`
- `invoiceNumber: type: String, default: ''`
- `agreementNumber: type: String, default: '', index: true`
- `registrationStartDate: type: Date`
- `registrationEndDate: type: Date, index: true`
- `dueDate: type: Date`
- `amount: type: Number, default: 0`
- `rentalAgreementFilesImages: type: [String], default: []`
**Indexes:**
- ` registrationEndDate: 1, amount: 1 `
- ` createdAt: -1 `

### SYMXRoutesInfo
**Fields:**
- `date: type: Date, required: true`
- `rowIndex: type: Number, required: true`
- `routeNumber: type: String, default: ""`
- `stopCount: type: String, default: ""`
- `packageCount: type: String, default: ""`
- `routeDuration: type: String, default: ""`
- `waveTime: type: String, default: ""`
- `pad: type: String, default: ""`
- `wst: type: String, default: ""`
- `wstDuration: type: String, default: ""`
- `bags: type: String, default: ""`
- `ov: type: String, default: ""`
- `stagingLocation: type: String, default: ""`
- `transporterId: type: String, default: ""`
- `rawSummary: type: Schema.Types.Mixed, default: {`
**Indexes:**
- ` date: 1, rowIndex: 1 `
- ` date: 1 `

### SYMXWSTOption
**Fields:**
- `wst: type: String, required: true, unique: true`
- `revenue: type: Number, default: 0`
- `isActive: type: Boolean, default: true`
- `sortOrder: type: Number, default: 0`
**Indexes:**
- ` wst: 1 `

### SymxAvailableWeek
**Fields:**
- `week: type: String, required: true, unique: true`

### Vehicle
**Fields:**
- `fleetCommunications: _id?: mongoose.Types.ObjectId;     date: Date;     status: string;     comments: string;     createdBy: string;     createdAt: Date;`
- `vin: type: String, required: true, unique: true, index: true`
- `year: type: String, default: ''`
- `vehicleName: type: String, default: ''`
- `licensePlate: type: String, default: '', index: true`
- `make: type: String, default: ''`
- `vehicleModel: type: String, default: ''`
- `status: type: String,     enum: ['Active', 'Inactive', 'Maintenance', 'Grounded', 'Decommissioned'],     default: 'Active',     index: true`
- `mileage: type: Number, default: 0`
- `serviceType: type: String, default: ''`
- `dashcam: type: String, default: ''`
- `vehicleProvider: type: String, default: ''`
- `ownership: type: String,     enum: ['Owned', 'Leased', 'Rented'],     default: 'Owned'`
- `unitNumber: type: String, default: '', index: true`
- `startDate: type: Date`
- `endDate: type: Date`
- `registrationExpiration: type: Date`
- `state: type: String, default: ''`
- `location: type: String, default: ''`
- `notes: type: String, default: ''`
- `info: type: String, default: ''`
- `image: type: String, default: ''`
- `locationFrom: type: String, default: ''`
- `date: type: Date, required: true`
- `status: type: String, default: ''`
- `comments: type: String, default: ''`
- `createdBy: type: String, default: ''`
- `createdAt: type: Date, default: Date.now`
**Indexes:**
- ` ownership: 1 `
- ` createdAt: -1 `
- ` status: 1, vehicleName: 1 `
- ` vehicleName: 1 `

### ScoreCardCDFNegative
**Fields:**
- `week: type: String, required: true, index: true`
- `deliveryGroupId: type: String`
- `deliveryAssociate: type: String, index: true`
- `deliveryAssociateName: type: String`
- `transporterId: type: String, index: true`
- `daMishandledPackage: type: String, default: ''`
- `daWasUnprofessional: type: String, default: ''`
- `daDidNotFollowInstructions: type: String, default: ''`
- `deliveredToWrongAddress: type: String, default: ''`
- `neverReceivedDelivery: type: String, default: ''`
- `receivedWrongItem: type: String, default: ''`
- `feedbackDetails: type: String, default: ''`
- `trackingId: type: String`
- `deliveryDate: type: String`
- `employeeId: type: Schema.Types.ObjectId, ref: 'SymxEmployee'`
**Indexes:**
- ` week: 1, deliveryAssociate: 1, trackingId: 1 `

### SymxEmployee
**Fields:**
- `firstName: type: String, default: ""`
- `lastName: type: String, default: ""`
- `eeCode: type: String`
- `transporterId: type: String, index: true`
- `badgeNumber: type: String`
- `gender: type: String`
- `type: type: String`
- `email: type: String`
- `phoneNumber: type: String`
- `streetAddress: type: String`
- `city: type: String`
- `state: type: String`
- `zipCode: type: String`
- `hiredDate: type: Date`
- `dob: type: Date`
- `hourlyStatus: type: String`
- `rate: type: Number`
- `gasCardPin: type: String`
- `dlExpiration: type: Date`
- `motorVehicleReportDate: type: Date`
- `profileImage: type: String`
- `sunday: type: String, default: 'OFF'`
- `monday: type: String, default: 'OFF'`
- `tuesday: type: String, default: 'OFF'`
- `wednesday: type: String, default: 'OFF'`
- `thursday: type: String, default: 'OFF'`
- `friday: type: String, default: 'OFF'`
- `saturday: type: String, default: 'OFF'`
- `defaultVan1: type: String`
- `defaultVan2: type: String`
- `defaultVan3: type: String`
- `finalCheckIssued: type: Boolean, default: false`
- `status: type: String, default: 'Active'`
- `offerLetterFile: type: String`
- `handbookFile: type: String`
- `driversLicenseFile: type: String`
- `i9File: type: String`
- `drugTestFile: type: String`
- `routesComp: type: String`
- `terminationDate: type: Date`
- `terminationLetter: type: String`
- `resignationDate: type: Date`
- `resignationLetter: type: String`
- `resignationType: type: String`
- `terminationReason: type: String`
- `eligibility: type: Boolean, default: false`
- `exitInterviewNotes: type: String`
- `paycomOffboarded: type: Boolean, default: false`
- `amazonOffboarded: type: Boolean, default: false`
- `finalCheck: type: String`
- `lastDateWorked: type: Date`
- `ScheduleNotes: type: String`
**Indexes:**
- ` status: 1, phoneNumber: 1 `
- ` transporterId: 1 `

### SymxNotification
**Fields:**
- `title: type: String, required: true`
- `message: type: String, required: true`
- `type: type: String, enum: ['info', 'success', 'warning', 'error'], default: 'info'`
- `read: type: Boolean, default: false`
- `createdAt: type: Date, default: Date.now`
- `relatedId: type: String`
- `link: type: String`

### SymxEmployeeSchedule
**Fields:**
- `status: type: String, enum: ['pending', 'sent', 'delivered', 'received'], required: true`
- `createdAt: type: Date, default: Date.now`
- `createdBy: type: String, default: 'system'`
- `messageLogId: type: Schema.Types.ObjectId, ref: 'MessageLog'`
- `openPhoneMessageId: type: String`
- `transporterId: type: String, required: true, index: true`
- `employeeId: type: Schema.Types.ObjectId, ref: 'SymxEmployee'`
- `weekDay: type: String, required: true`
- `yearWeek: type: String, required: true`
- `date: type: Date, required: true`
- `status: type: String, default: ''`
- `type: type: String, default: ''`
- `subType: type: String, default: ''`
- `trainingDay: type: String, default: ''`
- `startTime: type: String, default: ''`
- `dayBeforeConfirmation: type: String, default: ''`
- `dayOfConfirmation: type: String, default: ''`
- `weekConfirmation: type: String, default: ''`
- `van: type: String, default: ''`
- `note: type: String, default: ''`
- `futureShift: type: [MessageStatusEntrySchema], default: []`
- `shiftNotification: type: [MessageStatusEntrySchema], default: []`
- `offTodayScheduleTom: type: [MessageStatusEntrySchema], default: []`
- `weekSchedule: type: [MessageStatusEntrySchema], default: []`
- `routeItinerary: type: [MessageStatusEntrySchema], default: []`
**Indexes:**
- ` transporterId: 1, date: 1 `
- ` yearWeek: 1 `
- ` date: 1 `
- ` status: 1 `

### VehicleActivityLog
**Fields:**
- `vehicleId: type: Schema.Types.ObjectId, ref: 'Vehicle', index: true`
- `vin: type: String, default: '', index: true`
- `mileage: type: Number, default: 0`
- `serviceType: type: String, default: ''`
- `startDate: type: Date`
- `endDate: type: Date`
- `registrationExpiration: type: Date`
- `notes: type: String, default: ''`

### SymxHrTicket
**Fields:**
- `ticketNumber: type: String, index: true`
- `transporterId: type: String, index: true`
- `employeeId: type: Schema.Types.ObjectId, ref: "SymxEmployee"`
- `category: type: String`
- `issue: type: String`
- `attachment: type: String`
- `managersEmail: type: String`
- `notes: type: String`
- `approveDeny: type: String`
- `resolution: type: String`
- `holdReason: type: String`
- `closedDateTime: type: Date`
- `closedBy: type: String`
- `closedTicketSent: type: String`
- `createdBy: type: String`
**Indexes:**
- ` transporterId: 1, ticketNumber: 1 `

### VehicleInspection
**Fields:**
- `vehicleId: type: Schema.Types.ObjectId, ref: 'Vehicle', index: true`
- `vin: type: String, default: '', index: true`
- `unitNumber: type: String, default: ''`
- `inspectionType: type: String,      enum: ['Pre-Trip', 'Post-Trip', 'Monthly', 'Annual', 'DOT', 'Safety'],     default: 'Pre-Trip',     index: true`
- `inspectionDate: type: Date, default: Date.now`
- `inspectorName: type: String, default: ''`
- `overallResult: type: String,      enum: ['Pass', 'Fail', 'Needs Attention'],     default: 'Pass'`
- `mileage: type: Number, default: 0`
- `exteriorCondition: type: String, default: 'Good'`
- `interiorCondition: type: String, default: 'Good'`
- `tiresCondition: type: String, default: 'Good'`
- `brakesCondition: type: String, default: 'Good'`
- `lightsCondition: type: String, default: 'Good'`
- `fluidLevels: type: String, default: 'Normal'`
- `defectsFound: type: String, default: ''`
- `actionRequired: type: String, default: ''`
- `images: type: [String], default: []`
- `notes: type: String, default: ''`

### index
**Fields:**

### SymxDeliveryExcellence
**Fields:**
- `week: type: String, required: true`
- `deliveryAssociate: type: String`
- `transporterId: type: String, required: true`
- `employeeId: type: Schema.Types.ObjectId, ref: 'SymxEmployee'`
- `overallStanding: type: String`
- `overallScore: type: Number`
- `ficoMetric: type: Number`
- `ficoTier: type: String`
- `ficoScore: type: Number`
- `speedingEventRate: type: Number`
- `speedingEventRateTier: type: String`
- `speedingEventRateScore: type: Number`
- `seatbeltOffRate: type: Number`
- `seatbeltOffRateTier: type: String`
- `seatbeltOffRateScore: type: Number`
- `distractionsRate: type: Number`
- `distractionsRateTier: type: String`
- `distractionsRateScore: type: Number`
- `signSignalViolationsRate: type: Number`
- `signSignalViolationsRateTier: type: String`
- `signSignalViolationsRateScore: type: Number`
- `followingDistanceRate: type: Number`
- `followingDistanceRateTier: type: String`
- `followingDistanceRateScore: type: Number`
- `cdfDpmo: type: Number`
- `cdfDpmoTier: type: String`
- `cdfDpmoScore: type: Number`
- `ced: type: Number`
- `cedTier: type: String`
- `cedScore: type: Number`
- `dcr: type: String`
- `dcrTier: type: String`
- `dcrScore: type: Number`
- `dsb: type: Number`
- `dsbDpmoTier: type: String`
- `dsbDpmoScore: type: Number`
- `pod: type: String`
- `podTier: type: String`
- `podScore: type: Number`
- `psb: type: Number`
- `psbTier: type: String`
- `psbScore: type: Number`
- `packagesDelivered: type: Number`
- `ficoMetricWeightApplied: type: Number`
- `speedingEventRateWeightApplied: type: Number`
- `seatbeltOffRateWeightApplied: type: Number`
- `distractionsRateWeightApplied: type: Number`
- `signSignalViolationsRateWeightApplied: type: Number`
- `followingDistanceRateWeightApplied: type: Number`
- `cdfDpmoWeightApplied: type: Number`
- `cedWeightApplied: type: Number`
- `dcrWeightApplied: type: Number`
- `dsbDpmoWeightApplied: type: Number`
- `podWeightApplied: type: Number`
- `psbWeightApplied: type: Number`
**Indexes:**
- ` week: 1, transporterId: 1 `

### SymxSafetyDashboardDFO2
**Fields:**
- `week: type: String, required: true, index: true`
- `date: type: String`
- `deliveryAssociate: type: String`
- `transporterId: type: String, required: true, index: true`
- `eventId: type: String`
- `dateTime: type: String`
- `vin: type: String`
- `programImpact: type: String`
- `metricType: type: String`
- `metricSubtype: type: String`
- `source: type: String`
- `videoLink: type: String`
- `reviewDetails: type: String`
- `employeeId: type: Schema.Types.ObjectId, ref: 'SymxEmployee'`
- `dsp: type: String`
- `station: type: String`
**Indexes:**
- ` week: 1, transporterId: 1, eventId: 1 `

### SYMXSetting
**Fields:**
- `key: type: String, required: true, unique: true`
- `value: type: Schema.Types.Mixed, required: true`
- `description: type: String, default: ""`
**Indexes:**
- ` key: 1 `

### SymxReimbursement
**Fields:**
- `transporterId: type: String, required: true, index: true`
- `employeeName: type: String`
- `employeeId: type: Schema.Types.ObjectId, ref: "SymxEmployee"`
- `date: type: Date`
- `week: type: String, index: true`
- `category: type: String`
- `description: type: String`
- `amount: type: Number`
- `receiptNumber: type: String`
- `status: type: String, default: "Pending"`
- `approvedBy: type: String`
- `notes: type: String`
- `attachment: type: String`
- `createdBy: type: String`
- `updatedBy: type: String`
- `updatedOn: type: String`
**Indexes:**
- ` transporterId: 1, date: 1 `

### SYMXRescue
**Fields:**
- `routeId: type: Schema.Types.ObjectId, ref: "SYMXRoute", required: true`
- `date: type: String, required: true`
- `transporterId: type: String, required: true`
- `rescuedBytransporterId: type: String, required: true`
- `stopsRescued: type: Number, required: true, min: [0, "Stops rescued cannot be negative"]`
- `reason: type: String, required: true`
- `performanceRescue: type: Boolean, default: false`

### ScoreCardDCR
**Fields:**
- `week: type: String, required: true, index: true`
- `deliveryAssociate: type: String`
- `transporterId: type: String, required: true, index: true`
- `dcr: type: Number, default: 0`
- `packagesDelivered: type: Number, default: 0`
- `packagesDispatched: type: Number, default: 0`
- `packagesReturnedToStation: type: Number, default: 0`
- `packagesReturnedDAControllable: type: Number, default: 0`
- `rtsAllExempted: type: Number, default: 0`
- `rtsBusinessClosed: type: Number, default: 0`
- `rtsCustomerUnavailable: type: Number, default: 0`
- `rtsNoSecureLocation: type: Number, default: 0`
- `rtsOther: type: Number, default: 0`
- `rtsOutOfDriveTime: type: Number, default: 0`
- `rtsUnableToAccess: type: Number, default: 0`
- `rtsUnableToLocate: type: Number, default: 0`
- `rtsUnsafeDueToDog: type: Number, default: 0`
- `rtsBadWeather: type: Number, default: 0`
- `rtsLockerIssue: type: Number, default: 0`
- `rtsMissingOrIncorrectAccessCode: type: Number, default: 0`
- `rtsOtpNotAvailable: type: Number, default: 0`
- `employeeId: type: Schema.Types.ObjectId, ref: 'SymxEmployee'`
**Indexes:**
- ` week: 1, transporterId: 1 `

### SymxInterview
**Fields:**
- `fullName: type: String`
- `phoneNumber: type: String`
- `workStartDate: type: String`
- `typeOfWork: type: String`
- `workDays: type: String`
- `lastEmployerInfo: type: String`
- `howDidYouHear: type: String`
- `disclaimer: type: String`
- `status: type: String, default: "New"`
- `amazonOnboardingStatus: type: String`
- `interviewNotes: type: String`
- `rating: type: String`
- `image: type: String`
- `dlPhoto: type: String`
- `updatedBy: type: String`
- `updatedTimestamp: type: Date`
- `interviewedBy: type: String`
- `interviewTimestamp: type: Date`
- `onboardingPage: type: String`
- `eeCode: type: String`
- `transporterId: type: String, index: true`
- `badgeNumber: type: String`
- `firstName: type: String`
- `lastName: type: String`
- `gender: type: String`
- `email: type: String`
- `streetAddress: type: String`
- `city: type: String`
- `state: type: String`
- `zipCode: type: String`
- `hiredDate: type: Date`
- `dob: type: Date`
- `hourlyStatus: type: String`
- `rate: type: String`
- `gasCardPin: type: String`
- `dlExpiration: type: Date`
- `onboardingNotes: type: String`
- `backgroundCheckStatus: type: String`
- `backgroundCheckFile: type: String`
- `drugTestStatus: type: String`
- `drugTestFile: type: String`
- `offerLetterStatus: type: String`
- `offerLetterFile: type: String`
- `handbookStatus: type: String`
- `handbookFile: type: String`
- `paycomStatus: type: String`
- `i9Status: type: String`
- `i9File: type: String`
- `classroomTrainingDate: type: Date`
- `sexualHarassmentFile: type: String`
- `workOpportunityTaxCredit: type: String`
- `finalInterviewDate: type: Date`
- `finalInterviewTime: type: String`
- `finalInterviewBy: type: String`
- `finalInterviewStatus: type: String`
- `createdBy: type: String`
**Indexes:**
- ` fullName: 1 `
- ` status: 1 `

### SymxDVICVehicleInspection
**Fields:**
- `week: type: String, required: true`
- `startDate: type: String`
- `dsp: type: String`
- `station: type: String`
- `transporterId: type: String, required: true`
- `transporterName: type: String`
- `vin: type: String`
- `fleetType: type: String`
- `inspectionType: type: String`
- `inspectionStatus: type: String`
- `startTime: type: String`
- `endTime: type: String`
- `duration: type: String`
- `employeeId: type: Schema.Types.ObjectId, ref: 'SymxEmployee'`
**Indexes:**
- ` week: 1 `
- ` startDate: 1 `

### MessageLog
**Fields:**
- `openPhoneMessageId: type: String, index: true, sparse: true`
- `fromNumber: type: String, required: true`
- `fromDisplay: type: String, default: ""`
- `toNumber: type: String, required: true`
- `recipientName: type: String, default: ""`
- `messageType: type: String, required: true`
- `content: type: String, required: true`
- `status: type: String,             enum: ["sent", "delivered", "failed", "received_reply"],             default: "sent",`
- `deliveredAt: type: Date`
- `repliedAt: type: Date`
- `replyContent: type: String`
- `sentAt: type: Date, default: Date.now`
- `errorMessage: type: String`
- `deliveryWebhookPayload: type: Schema.Types.Mixed`
- `replyWebhookPayload: type: Schema.Types.Mixed`
**Indexes:**
- ` toNumber: 1, messageType: 1, sentAt: -1 `

### SymxPhotoOnDelivery
**Fields:**
- `week: type: String, required: true`
- `transporterId: type: String, required: true`
- `employeeId: type: Schema.Types.ObjectId, ref: 'SymxEmployee'`
- `opportunities: type: Number, default: 0`
- `success: type: Number, default: 0`
- `bypass: type: Number, default: 0`
- `rejects: type: Number, default: 0`
- `blurryPhoto: type: Number, default: 0`
- `humanInThePicture: type: Number, default: 0`
- `noPackageDetected: type: Number, default: 0`
- `packageInCar: type: Number, default: 0`
- `packageInHand: type: Number, default: 0`
- `packageNotClearlyVisible: type: Number, default: 0`
- `packageTooClose: type: Number, default: 0`
- `photoTooDark: type: Number, default: 0`
- `other: type: Number, default: 0`
**Indexes:**
- ` week: 1, transporterId: 1 `

### SymxUser
**Fields:**
- `name: type: String, required: true, index: true`
- `email: type: String, required: true, unique: true, index: true`
- `password: type: String`
- `phone: type: String`
- `address: type: String`
- `serialNo: type: String, index: true`
- `signature: type: String`
- `AppRole: type: String,      required: true,     default: 'Manager',     index: true`
- `designation: type: String`
- `bioDescription: type: String`
- `isOnWebsite: type: Boolean, default: false`
- `profilePicture: type: String`
- `isActive: type: Boolean, default: true, index: true`
- `location: type: String`


## 5. QUERY SHAPES
| API File | .find() count | .aggregate() count |
|---|---|---|
| `app/api/admin/roles/route.ts` | 0 | 1 |
| `app/api/admin/imports/route.ts` | 2 | 0 |
| `app/api/admin/migrate-images/route.ts` | 1 | 0 |
| `app/api/schedules/route.ts` | 1 | 1 |
| `app/api/schedules/notes/route.ts` | 1 | 1 |
| `app/api/schedules/audit/route.ts` | 0 | 1 |
| `app/api/public/migrate-repair-images/route.ts` | 1 | 0 |
| `app/api/public/confirm/[token]/route.ts` | 4 | 0 |
| `app/api/dispatching/routes/route.ts` | 3 | 2 |
| `app/api/dispatching/routes-info/route.ts` | 2 | 0 |
| `app/api/everyday/route.ts` | 1 | 0 |
| `app/api/everyday/rts/route.ts` | 1 | 0 |
| `app/api/everyday/rescue/route.ts` | 1 | 0 |
| `app/api/fleet/route.ts` | 11 | 3 |
| `app/api/fleet/vehicles/[id]/route.ts` | 3 | 0 |
| `app/api/messaging/history/route.ts` | 1 | 0 |
| `app/api/messaging/templates/route.ts` | 1 | 0 |
| `app/api/messaging/live-status/route.ts` | 0 | 1 |
| `app/api/messaging/employees/route.ts` | 0 | 1 |
| `app/api/scorecard/employee-performance/route.ts` | 10 | 0 |

## 6. REALTIME SYSTEM
- **SSE Schema**: Not found. No Server-Sent Events or WebSockets (`EventSource`, `ReadableStream`, `socket.io`) are actively broadcasting from Next.js APIs.
- **Alternative Realtime**: The project uses a global prefetch engine (`hooks/use-data-store.ts`) with `setInterval` polling every 60 seconds (`_startAutoRefresh()`) instead of a persistent socket connection.

## 7. CACHE AND STATE
- **Global Store**: `useDataStore` acts as a global cache (V2 'Instant Load' architecture).
- **Keys**: `admin.routeTypes`, `admin.dropdowns`, `scheduling.weeks`, `fleet.dashboard`, `hr.claims`, etc.
- **Invalidation/TTL**: Default TTL is 5 minutes (`300000ms`). Focus stale threshold is 2 minutes.
- **Deduplication**: In-flight requests are tracked via `_inflightRequests = new Map()`.

## 8. PERFORMANCE-CRITICAL FLOWS
- **First App Load**: `_prefetchAll()` splits loading into CRITICAL (blocks UI ~0.5-1s) and DEFERRED (background trickle loaded to prevent UI block).
- **Tab Switch**: Tabs resolve instantly via `useDataStore.get(key)` returning cached datasets.

## 9. AUTH AND SECURITY
- **Login Flow**: `/api/auth/login` manually verifies credentials and issues a token/session via NextAuth or JWT (inferred from `/api/auth/session`).
- **RBAC**: Handled by `SymxAppRole` schema which defines permissions (view, create, edit, delete, approve, download) on a per-module basis.

## 10. UNUSED / REDUNDANT / LEGACY
- `index.ts` in `lib/models` is empty.
- Some `app/api/...` endpoint duplicates might exist, e.g. mapping `/fleet` vs `/fleet/vehicles/[id]`.

## 11. KNOWN PROBLEMS FROM CODE
- The cache polling (`_startAutoRefresh`) executes every 60s for all '*active*' datasets, which could lead to redundant polling if datasets aren't completely segregated by focus.

## 12. FILE MAP
- `app/`: Next.js 13+ App Router (pages and layouts)
- `app/api/`: API Routes (Next.js serverless functions)
- `components/`: UI components and shared widgets
- `hooks/`: React hooks (`use-data-store.ts` for caching)
- `lib/models/`: Mongoose schemas and definitions
- `lib/`: Utilities (`auth.ts`, `db.ts`, etc.)
