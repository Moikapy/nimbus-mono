/**
 * Client-side tier gating logic.
 * Mirrors server-side limits so the UI can hide/show controls.
 */

export type Tier = "free" | "pro" | "premier";

const LIMITS: Record<Tier, { messages: number; imageGen: number; models: "all" | string[]; webSearch: boolean; fileUpload: boolean; concurrentImages: number }> = {
  free: { messages: 50, imageGen: 0, models: ["@cf/zai-org/glm-4.7-flash"], webSearch: false, fileUpload: false, concurrentImages: 0 },
  pro: { messages: 1000, imageGen: 50, models: "all", webSearch: true, fileUpload: true, concurrentImages: 1 },
  premier: { messages: 15000, imageGen: 500, models: "all", webSearch: true, fileUpload: true, concurrentImages: 5 },
};

export function isFeatureAllowed(feature: "webSearch" | "fileUpload", tier: Tier): boolean {
  return LIMITS[tier][feature];
}

export function isImageGenAllowed(tier: Tier): boolean {
  return LIMITS[tier].imageGen > 0;
}

export function getImageGenLimit(tier: Tier): number {
  return LIMITS[tier].imageGen;
}

export function isModelAllowed(model: string, tier: Tier): boolean {
  const m = LIMITS[tier].models;
  if (m === "all") return true;
  return m.includes(model);
}

export function getMessageLimit(tier: Tier): number {
  return LIMITS[tier].messages;
}
