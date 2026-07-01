/**
 * PAI Model Gallery 训练数据格式转换
 *
 * 项目内 train.jsonl 为 messages（ShareGPT）格式；PAI QuickStart 默认按 Alpaca 解析，
 * 易导致预处理后 0 条样本。本模块产出 instruction/input/output 格式供 PAI 使用。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import type { TrainingSample } from './training-data.service.js';

/** PAI Alpaca 单条样本（instruction / input / output） */
export interface PaiAlpacaSample {
  instruction: string;
  input: string;
  output: string;
}

/**
 * 将 messages 样本转为 PAI Alpaca 格式（system + user 合并为 instruction）。
 *
 * @param sample - 含 system / user / assistant 的训练样本
 * @returns Alpaca 字段对象，output 为 assistant 纯 JSON 字符串
 */
export function toPaiAlpacaSample(sample: TrainingSample): PaiAlpacaSample {
  const system = sample.messages.find((m) => m.role === 'system')?.content?.trim() ?? '';
  const user = sample.messages.find((m) => m.role === 'user')?.content?.trim() ?? '';
  const assistant = sample.messages.find((m) => m.role === 'assistant')?.content?.trim() ?? '';

  const instruction = system && user ? `${system}\n\n${user}` : user || system;

  return {
    instruction,
    input: '',
    output: assistant,
  };
}

/**
 * 读取 messages JSONL 并写入 PAI Alpaca JSONL。
 *
 * @param inputPath - 源 train.jsonl / val.jsonl 路径
 * @param outputPath - 目标 train-pai.jsonl 路径
 * @returns 成功转换条数；任一行 JSON 解析失败则抛出异常
 */
export function convertJsonlToPaiAlpaca(inputPath: string, outputPath: string): number {
  const lines = readFileSync(inputPath, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const converted: PaiAlpacaSample[] = [];
  for (const line of lines) {
    const sample = JSON.parse(line) as TrainingSample;
    const alpaca = toPaiAlpacaSample(sample);
    if (!alpaca.instruction || !alpaca.output) {
      throw new Error(`样本缺少 instruction 或 output: ${line.slice(0, 80)}…`);
    }
    converted.push(alpaca);
  }

  writeFileSync(
    outputPath,
    converted.map((row) => JSON.stringify(row)).join('\n') + (converted.length ? '\n' : ''),
    'utf8',
  );
  return converted.length;
}
