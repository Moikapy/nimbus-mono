/**
 * Data preset tools — generic utilities for filtering, sorting, aggregating data.
 * No domain knowledge. Works on any array of objects the model passes in.
 */

import { z } from "zod";
import type { ToolDef } from "../core/types";

export function dataTools(): Record<string, ToolDef> {
  return {
    data_filter: {
      description: "Filter an array of objects by a field value. Returns matching items.",
      parameters: z.object({
        data: z.array(z.record(z.string(), z.unknown())).describe("Array of objects to filter"),
        field: z.string().describe("Field name to filter on"),
        operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "contains"]).describe("Comparison operator"),
        value: z.unknown().describe("Value to compare against"),
      }),
      execute: async (params) => {
        const { data, field, operator, value } = params as {
          data: Record<string, unknown>[];
          field: string;
          operator: string;
          value: unknown;
        };
        const ops: Record<string, (a: unknown, b: unknown) => boolean> = {
          eq: (a, b) => a === b,
          neq: (a, b) => a !== b,
          gt: (a, b) => Number(a) > Number(b),
          gte: (a, b) => Number(a) >= Number(b),
          lt: (a, b) => Number(a) < Number(b),
          lte: (a, b) => Number(a) <= Number(b),
          contains: (a, b) => String(a).toLowerCase().includes(String(b).toLowerCase()),
        };
        const fn = ops[operator];
        if (!fn) throw new Error(`Unknown operator: ${operator}`);
        return data.filter(item => fn(item[field], value));
      },
    },
    data_sort: {
      description: "Sort an array of objects by a field. Returns sorted array.",
      parameters: z.object({
        data: z.array(z.record(z.string(), z.unknown())).describe("Array of objects to sort"),
        field: z.string().describe("Field name to sort by"),
        order: z.enum(["asc", "desc"]).default("desc").describe("Sort direction"),
      }),
      execute: async (params) => {
        const { data, field, order } = params as {
          data: Record<string, unknown>[];
          field: string;
          order: string;
        };
        return [...data].sort((a, b) => {
          const va = a[field];
          const vb = b[field];
          const cmp = Number(va ?? 0) - Number(vb ?? 0);
          return order === "asc" ? cmp : -cmp;
        });
      },
    },
    data_aggregate: {
      description: "Aggregate data by a group field. Returns sum, count, average per group.",
      parameters: z.object({
        data: z.array(z.record(z.string(), z.unknown())).describe("Array of objects"),
        groupBy: z.string().describe("Field to group by"),
        valueField: z.string().describe("Numeric field to aggregate"),
        operation: z.enum(["sum", "count", "avg"]).describe("Aggregation operation"),
      }),
      execute: async (params) => {
        const { data, groupBy, valueField, operation } = params as {
          data: Record<string, unknown>[];
          groupBy: string;
          valueField: string;
          operation: string;
        };
        const groups = new Map<string, number[]>();
        for (const item of data) {
          const key = String(item[groupBy] ?? "unknown");
          const val = Number(item[valueField] ?? 0);
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(val);
        }
        const result: Record<string, unknown>[] = [];
        for (const [key, values] of groups) {
          const sum = values.reduce((a, b) => a + b, 0);
          result.push({
            [groupBy]: key,
            value: operation === "sum" ? sum : operation === "count" ? values.length : sum / values.length,
          });
        }
        return result;
      },
    },
    data_top: {
      description: "Get top N items from an array sorted by a numeric field.",
      parameters: z.object({
        data: z.array(z.record(z.string(), z.unknown())).describe("Array of objects"),
        field: z.string().describe("Numeric field to sort by"),
        n: z.number().min(1).max(100).default(5).describe("Number of top items"),
      }),
      execute: async (params) => {
        const { data, field, n } = params as {
          data: Record<string, unknown>[];
          field: string;
          n: number;
        };
        const sorted = [...data].sort((a, b) => Number(b[field] ?? 0) - Number(a[field] ?? 0));
        return sorted.slice(0, n);
      },
    },
  };
}
