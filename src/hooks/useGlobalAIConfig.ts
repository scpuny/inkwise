// useGlobalAIConfig.ts — React hook 用于全局 AI 配置管理
// 所有 AI 组件都应使用此 hook 而非各自维护状态

import { useState, useCallback, useEffect } from "react";
import type { EffortLevel, TokenLimit } from "../lib/config/globalAIConfig";
import {
  loadGlobalAIConfig,
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

let _cachedConfig: ReturnType<typeof loadGlobalAIConfig> | null = null;
let _cachedModelList: ReturnType<typeof buildModelList> | null = null;

export function useGlobalAIConfig(): UseGlobalAIConfigReturn {
  const [config, setConfig] = useState(() => {
    _cachedConfig = _cachedConfig || loadGlobalAIConfig();
    return _cachedConfig;
  });

  const [modelList, setModelList] = useState(() => {
    _cachedModelList = _cachedModelList || buildModelList();
    return _cachedModelList;
  });

  // Listen for config changes from other components
  useEffect(() => {
    const handler = () => {
      _cachedConfig = loadGlobalAIConfig();
      _cachedModelList = buildModelList();
      setConfig(_cachedConfig);
      setModelList(_cachedModelList);
    };
    window.addEventListener("ai-config-changed", handler);
    window.addEventListener("providers-changed", handler);
    return () => {
      window.removeEventListener("ai-config-changed", handler);
      window.removeEventListener("providers-changed", handler);
    };
  }, []);

  const setDefaultModel = useCallback((model: string) => {
    saveDefaultModel(model);
    _cachedConfig = loadGlobalAIConfig();
    setConfig(_cachedConfig);
  }, []);

  const setEffort = useCallback((effort: EffortLevel) => {
    saveEffort(effort);
    _cachedConfig = loadGlobalAIConfig();
    setConfig(_cachedConfig);
  }, []);

  const setMaxTokens = useCallback((tokens: TokenLimit) => {
    saveMaxTokens(tokens);
    _cachedConfig = loadGlobalAIConfig();
    setConfig(_cachedConfig);
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
