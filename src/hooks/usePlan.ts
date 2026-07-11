// ─── usePlan — 规划操作 Hook ───

import { useState, useCallback } from "react";
import type { PlanInput, PartialPlan, PlanGenStep, OutlineSection } from "../domain";
import { PlanService } from "../services/PlanService";

export function usePlan(planService: PlanService) {
  const [planState, setPlanState] = useState<"idle" | "planning" | "review-title-desc" | "review">("idle");
  const [planStep, setPlanStep] = useState<PlanGenStep>("idle");
  const [plan, setPlan] = useState<PartialPlan>({
    title: "", description: "", outline: [], tags: [],
  });

  const startPlan = useCallback(async (input: PlanInput) => {
    setPlanState("planning");
    const isNewDoc = !input.prefilledTitle;

    try {
      const gen = planService.generatePlan(input, isNewDoc);
      for await (const result of gen) {
        if (result.step === "title" && typeof result.data === "string") {
          setPlan(p => ({ ...p, title: result.data as string }));
        } else if (result.step === "description" && typeof result.data === "string") {
          setPlan(p => ({ ...p, description: result.data as string }));
        } else if (result.step === "outline" && Array.isArray(result.data)) {
          setPlan(p => ({ ...p, outline: result.data as OutlineSection[] }));
        } else if (result.step === "tags" && Array.isArray(result.data)) {
          setPlan(p => ({ ...p, tags: result.data as string[] }));
        } else if (result.step === "stage1-done") {
          setPlanStep("stage1-done");
          setPlanState("review-title-desc");
          return;
        }
        setPlanStep(result.step);
      }
      setPlanState("review");
    } catch {
      setPlanState("review");
    }
  }, [planService]);

  const continueToOutline = useCallback(async (input: PlanInput, title: string, desc: string) => {
    setPlanState("planning");
    try {
      const gen = planService.generateStage2(input, title, desc);
      for await (const result of gen) {
        if (result.step === "outline" && Array.isArray(result.data)) {
          setPlan(p => ({ ...p, outline: result.data as OutlineSection[] }));
        } else if (result.step === "tags" && Array.isArray(result.data)) {
          setPlan(p => ({ ...p, tags: result.data as string[] }));
        }
        setPlanStep(result.step);
      }
      setPlanState("review");
    } catch {
      setPlanState("review");
    }
  }, [planService]);

  return { planState, planStep, plan, startPlan, continueToOutline, setPlanState, setPlan };
}
