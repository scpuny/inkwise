// ─── PlanService — 文章规划编排服务 ───
// 依赖 Infrastructure 接口，不直接调用 Tauri / localStorage / AI

import type {
  ArticleDocument,
  PlanInput,
  PlanGenStep,
  PlanStepResult,
  OutlineSection,
} from "../domain";
import type { AIProvider } from "../infrastructure/AIProvider";
import type { DocumentStore } from "../infrastructure/DocumentStore";

export class PlanService {
  constructor(
    private readonly ai: AIProvider,
    private readonly store: DocumentStore,
  ) {}

  /** 生成标题 */
  async generateTitle(input: PlanInput): Promise<string> {
    const prompt = `你是一位写作专家。请根据以下灵感生成一个吸引人的标题。
直接输出标题，不要任何思考过程。使用流畅自然的中文。

灵感：${input.inspiration}
${input.tone ? `整体基调：${input.tone}` : ""}
${input.targetAudience ? `目标读者：${input.targetAudience}` : ""}`;

    const result = await this.ai.chat([
      { role: "system", content: "你是一位写作专家。直接输出标题，不要思考过程。使用流畅自然的中文。" },
      { role: "user", content: prompt },
    ], { maxTokens: 256 });

    const cleaned = result.trim().replace(/^["']|["']$/g, "").trim();
    return cleaned || input.inspiration.slice(0, 40) || "无标题";
  }

  /** 生成简介 */
  async generateDescription(input: PlanInput, title: string): Promise<string> {
    const prompt = `请根据以下信息生成文章简介（一句话概括）：
灵感：${input.inspiration}
标题：${title}
直接输出简介，不要思考过程。使用中文。`;

    const result = await this.ai.chat([
      { role: "system", content: "直接输出文章简介，不要思考过程。使用中文。" },
      { role: "user", content: prompt },
    ], { maxTokens: 512 });

    return result.trim().replace(/^["']|["']$/g, "").trim() || `关于「${title}」的一篇文章`;
  }

  /** 生成大纲 */
  async generateOutline(input: PlanInput, title: string, description: string): Promise<OutlineSection[]> {
    const prompt = `请根据以下信息生成文章大纲：

标题：${title}
简介：${description}
${input.tone ? `整体基调：${input.tone}` : ""}

要求：
- 一级章节用 ## 开头，二级用 ###
- 每条格式：序号 —— 描述（10-20字）
- 至少3个一级章节，每章节2-3个子章节
- 直接输出，不要思考过程
- 使用流畅自然的中文`;

    const result = await this.ai.chat([
      { role: "system", content: "你是一位写作规划师。直接输出大纲，不要思考过程。使用中文。" },
      { role: "user", content: prompt },
    ], { maxTokens: 2048 });

    return this._parseOutline(result);
  }

  /** 生成标签 */
  async generateTags(input: PlanInput, title: string, description: string): Promise<string[]> {
    const prompt = `根据标题「${title}」和简介「${description}」生成3-5个标签。
直接输出逗号分隔的标签，不要序号，不要思考过程。`;

    const result = await this.ai.chat([
      { role: "system", content: "直接输出标签，不要思考过程。" },
      { role: "user", content: prompt },
    ], { maxTokens: 256 });

    return result
      .split(/[,，、\s\n]+/)
      .map((t) => t.trim().replace(/^#/, ""))
      .filter((t) => t.length > 0)
      .slice(0, 10);
  }

  /** 完整的规划生成流程（yield 步骤） */
  async *generatePlan(input: PlanInput, stage1?: boolean): AsyncGenerator<PlanStepResult> {
    yield { step: "idle" as PlanGenStep, data: null };

    const title = input.prefilledTitle || await this.generateTitle(input);
    yield { step: "title" as PlanGenStep, data: title };

    const description = input.prefilledDescription || await this.generateDescription(input, title);
    yield { step: "description" as PlanGenStep, data: description };

    if (stage1) {
      yield { step: "stage1-done" as PlanGenStep, data: null };
      return;
    }

    const outline = await this.generateOutline(input, title, description);
    yield { step: "outline" as PlanGenStep, data: outline };

    const tags = await this.generateTags(input, title, description);
    yield { step: "tags" as PlanGenStep, data: tags };

    yield { step: "done" as PlanGenStep, data: null };
  }

  /** 第二阶段：根据确认后的标题+描述生成大纲+标签 */
  async *generateStage2(
    input: PlanInput,
    title: string,
    description: string,
  ): AsyncGenerator<PlanStepResult> {
    const outline = await this.generateOutline(input, title, description);
    yield { step: "outline" as PlanGenStep, data: outline };

    const tags = await this.generateTags(input, title, description);
    yield { step: "tags" as PlanGenStep, data: tags };

    yield { step: "done" as PlanGenStep, data: null };
  }

  // ─── 私有 ───

  private _parseOutline(raw: string): OutlineSection[] {
    const sections: OutlineSection[] = [];
    const lines = raw.split("\n");
    let index = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // ## 1. 标题 —— 描述 或 ## 1. 标题：描述
      const h2Match = trimmed.match(/^##\s+(\d+)\.\s*(.+?)(?:\s*[——：:]\s*(.+))?$/);
      if (h2Match) {
        sections.push({
          id: `section-${++index}`,
          title: h2Match[2].trim(),
          level: 1,
          description: h2Match[3]?.trim(),
          status: "pending",
        });
        continue;
      }

      // ### 1.1 子标题 —— 描述
      const h3Match = trimmed.match(/^###\s+(\d+)\.(\d+)\s*(.+?)(?:\s*[——：:]\s*(.+))?$/);
      if (h3Match) {
        sections.push({
          id: `section-${++index}`,
          title: h3Match[3].trim(),
          level: 2,
          description: h3Match[4]?.trim(),
          status: "pending",
        });
        continue;
      }
    }

    return sections.length > 0 ? sections : [
      { id: "section-1", title: raw.slice(0, 80), level: 1, status: "pending" },
    ];
  }
}
