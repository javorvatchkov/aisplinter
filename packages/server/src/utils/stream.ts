import { StreamAggregationResult } from '../adapters/types.js';

export async function aggregateStream(
  stream: ReadableStream,
  onChunk?: (chunk: any) => void
): Promise<StreamAggregationResult> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  
  let model = '';
  let contentLength = 0;
  let chunks = 0;
  let providerUsage: any = null;
  let rawFinalChunk: any = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split('\n').filter(l => l.trim() !== '');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const dataStr = line.replace('data: ', '');
        if (dataStr === '[DONE]') break;

        try {
          const data = JSON.parse(dataStr);
          chunks++;
          if (data.model) model = data.model;
          if (data.choices?.[0]?.delta?.content) {
            contentLength += data.choices[0].delta.content.length;
          }
          if (data.usage) {
            providerUsage = data.usage;
          }
          rawFinalChunk = data;
          if (onChunk) onChunk(data);
        } catch (e) {
          console.error('Error parsing stream chunk:', e);
        }
      }
    }
  }

  return {
    model,
    chunks,
    contentLength,
    providerUsage,
    rawFinalChunk,
  };
}
