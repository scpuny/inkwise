// embedding/embed.mjs — Node.js Transformers.js 嵌入服务
//
// 通过 stdin 接收 JSON: { "texts": ["...", "..."] }
// 通过 stdout 返回 JSON: { "embeddings": [[...], [...]] }
//
// 环境变量:
//   MODEL_DIR — ONNX 模型及 tokenizer 所在目录（默认从 HuggingFace Hub 缓存）
//   MODEL_NAME — 模型名称（默认 "Xenova/bge-small-zh-v1.5"）

import { pipeline } from '@xenova/transformers';
import { createInterface } from 'readline';

const MODEL_NAME = process.env.MODEL_NAME || 'Xenova/bge-small-zh-v1.5';
const MODEL_DIR = process.env.MODEL_DIR || null;

let embedder = null;

// 延迟初始化模型（首次请求时加载）
async function getEmbedder() {
    if (!embedder) {
        const options = {};
        if (MODEL_DIR) {
            // 使用本地模型路径
            options.modelPath = MODEL_DIR;
        }
        // 缓存到 ~/.inkwise/models/cache/
        options.cache_dir = process.env.HOME + '/.inkwise/models/cache';
        embedder = await pipeline('feature-extraction', MODEL_NAME, options);
    }
    return embedder;
}

// 标准化向量
function normalize(vec) {
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    if (norm === 0) return vec;
    return vec.map(v => v / norm);
}

// 处理一行 JSON 输入
async function handleLine(line) {
    try {
        const input = JSON.parse(line);
        if (!input.texts || !Array.isArray(input.texts)) {
            process.stdout.write(JSON.stringify({ embeddings: [], error: 'texts 必须为字符串数组' }) + '\n');
            return;
        }

        const pipe = await getEmbedder();
        const results = [];

        for (const text of input.texts) {
            if (!text || text.trim().length === 0) {
                results.push([]);
                continue;
            }
            // 使用池化（mean pooling）获取整个句子的向量
            const output = await pipe(text, {
                pooling: 'mean',
                normalize: true,
            });
            // 提取 float32 数组
            const embedding = Array.from(output.data);
            results.push(embedding);
        }

        process.stdout.write(JSON.stringify({ embeddings: results }) + '\n');
    } catch (err) {
        process.stdout.write(JSON.stringify({ embeddings: [], error: err.message }) + '\n');
    }
}

// 启动 REPL 循环
const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', handleLine);
rl.on('close', () => process.exit(0));

// 发送就绪信号
process.stdout.write(JSON.stringify({ ready: true }) + '\n');
