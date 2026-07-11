// domain/index.ts — 领域层统一导出
export * from "./Document";
export * from "./Collection";
export * from "./Plan";
export * from "./Project";
// enums.ts 单独导出（避免 PlanStep 冲突等）
export {
  DocumentPhase,
  Phase,
  PlanStep,
  PlanState,
  EventName,
  DocumentSource,
  DEFAULTS,
} from "./enums";
