// useGlobalAIConfig.ts — React hook 用于全局 AI 配置管理
// 所有 AI 组件都应使用此 hook 而非各自维护状态
//
// 初始化策略：
// 1. 首次渲染：从 localStorage 缓存同步读取（立即显示）
// 2. 组件挂载：从后端异步加载权威数据，更新状态
// 3. 配置变更：同时写后端 + 缓存，通过事件同步多组件

import { useState, useCallback, useEffect } from "react";
import { on } from "../lib/events/eventBus";
import type { EffortLevel, TokenLimit } from "../lib/config/globalAIConfig";
import {
  loadGlobalAIConfig,
  loadGlobalAIConfigAsync,
  saveDefaultModel,
  saveEffort,
  saveMaxTokens,
  buildModelList,
} from "../lib/config/globalAIConfig";

export interface UseGlobalAIConfigReturn {
  defaultModel: string | null;
  effort: EffortLevel;
  maxTokens: number;
  modelList: { id: string; label: string; provider: string }[];
  setDefaultModel: (model: string) => void;
  setEffort: (effort: EffortLevel) => void;
  setMaxTokens: (tokens: TokenLimit) => void;
}

export function useGlobalAIConfig(): UseGlobalAIConfigReturn {
  const [config, setConfig] = useState(() => loadGlobalAIConfig());
  const [modelList, setModelList] = useState(() => buildModelList());

  // 挂载时从后端加载权威数据
  useEffect(() => {
    loadGlobalAIConfigAsync().then((c) => {
      setConfig(c);
      setModelList(buildModelList());
    });
  }, []);

  // 监听来自其他组件的配置变更事件
  useEffect(() => {
    const handler = async () => {
      const c = await loadGlobalAIConfigAsync();
      setConfig(c);
      setModelList(buildModelList());
    };
    const dispose1 = on("ai-config-changed", handler);
    const dispose2 = on("providers-changed", handler);
    return () => {
      dispose1();
      dispose2();
    };
  }, []);

  const setDefaultModel = useCallback((model: string) => {
    saveDefaultModel(model).then(() => {
      setConfig(loadGlobalAIConfig());
    });
  }, []);

  const setEffort = useCallback((effort: EffortLevel) => {
    saveEffort(effort).then(() => {
      setConfig(loadGlobalAIConfig());
    });
  }, []);

  const setMaxTokens = useCallback((tokens: TokenLimit) => {
    saveMaxTokens(tokens).then(() => {
      setConfig(loadGlobalAIConfig());
    });
  }, []);

  return {
    defaultModel: config.defaultModel,
    effort: config.effort,
    maxTokens: config.maxTokens,
    modelList,
    setDefaultModel,
    setEffort,
    setMaxTokens,
  };
}
