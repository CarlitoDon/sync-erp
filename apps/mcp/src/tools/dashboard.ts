/**
 * Dashboard Tools
 */
import type { ToolSpec } from '../types.js';
import { apiQuery } from '../client.js';
import { getString, companyIdProp } from './_helpers.js';

export function getDashboardTools(): ToolSpec[] {
  return [
    {
      name: 'dashboard_kpis',
      description: 'Get dashboard KPI summary (revenue, expenses, orders, etc.)',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp },
        required: ['companyId'],
      },
      handler: async (args) =>
        apiQuery('dashboard.getKPIs', {}, getString(args, 'companyId')),
    },
    {
      name: 'dashboard_metrics',
      description: 'Get detailed dashboard metrics',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp },
        required: ['companyId'],
      },
      handler: async (args) =>
        apiQuery('dashboard.getMetrics', {}, getString(args, 'companyId')),
    },
  ];
}
