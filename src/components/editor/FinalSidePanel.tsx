import type { PublishRecord } from "../../lib/storage/platforms";
import type { OutlineSection } from "../../lib/ai/article/blueprint";
import { ArticleInfoPanel } from "./ArticleInfoPanel";
import { BlueprintProgress } from "./BlueprintProgress";
import { PublishStatusPanel } from "./PublishStatusPanel";
import { FileText, Layers, Send } from "lucide-react";

interface FinalSidePanelProps {
  title: string;
  wordCount: number;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  coverImage?: string | null;
  blueprintSections: OutlineSection[];
  blueprintPhase: string;
  publishRecords: PublishRecord[];
  onPublish: () => void;
}

export function FinalSidePanel({
  title, wordCount, createdAt, updatedAt, tags, coverImage,
  blueprintSections, blueprintPhase, publishRecords, onPublish,
}: FinalSidePanelProps) {
  return (
    <div className="final-sidepanel">
      <div className="final-sidepanel__section">
        <div className="final-sidepanel__section-title">
          <FileText size={14} /> 文章信息
        </div>
        <ArticleInfoPanel
          title={title}
          wordCount={wordCount}
          createdAt={createdAt}
          updatedAt={updatedAt}
          tags={tags}
          coverImage={coverImage}
        />
      </div>

      {blueprintSections.length > 0 && (
        <div className="final-sidepanel__section">
          <div className="final-sidepanel__section-title">
            <Layers size={14} /> 写作蓝图
          </div>
          <BlueprintProgress sections={blueprintSections} phase={blueprintPhase} />
        </div>
      )}

      <div className="final-sidepanel__section">
        <div className="final-sidepanel__section-title">
          <Send size={14} /> 发布状态
        </div>
        <PublishStatusPanel publishRecords={publishRecords} onPublish={onPublish} />
      </div>
    </div>
  );
}
