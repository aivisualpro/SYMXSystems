export const qk = {
  employees: {
    all: ['employees'] as const,
    list: (filters?: object) => ['employees', 'list', filters] as const,
    detail: (id: string) => ['employees', 'detail', id] as const,
  },
  schedules: {
    week: (yw: string) => ['schedules', 'week', yw] as const,
    audit: (yw: string) => ['schedules', 'audit', yw] as const,
    weeks: ['schedules', 'weeks'] as const,
  },
  hr: {
    dashboard: ['hr', 'dashboard'] as const,
    tickets: ['hr', 'tickets'] as const,
    claims: ['hr', 'claims'] as const,
    claimsKpi: ['hr', 'claimsKpi'] as const,
    reimbursements: ['hr', 'reimbursements'] as const,
    reimbursementsKpi: ['hr', 'reimbursementsKpi'] as const,
    audit: ['hr', 'audit'] as const,
    interviews: ['hr', 'interviews'] as const,
    terminations: ['hr', 'terminations'] as const,
  },
  admin: {
    routeTypes: ['admin', 'routeTypes'] as const,
    dropdowns: ['admin', 'dropdowns'] as const,
    modules: ['admin', 'modules'] as const,
    users: ['admin', 'users'] as const,
    roles: ['admin', 'roles'] as const,
    wst: ['admin', 'wst'] as const,
  },
  permissions: {
    current: ['permissions', 'current'] as const,
  },
  fleet: {
    dashboard: ['fleet', 'dashboard'] as const,
    vehicles: ['fleet', 'vehicles'] as const,
    repairs: ['fleet', 'repairs'] as const,
    inspections: ['fleet', 'inspections'] as const,
    rentals: ['fleet', 'rentals'] as const,
  },
  dispatching: {
    routes: (yw: string) => ['dispatching', 'routes', yw] as const,
  },
  messaging: {
    employees: (filter: string, yw: string) => ['messaging', 'employees', filter, yw] as const,
  },
}
