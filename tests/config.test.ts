import { describe, it, expect } from 'vitest';
import { config } from '../src/lib/config.ts';

describe('Config Structure', () => {
  it('should have providers defined', () => {
    expect(config.providers).toBeDefined();
  });

  it('should have OpenRouter baseUrl correctly set', () => {
    expect(config.providers.openrouter.baseUrl).toBe("https://openrouter.ai/api/v1");
  });

  it('should have LMStudio baseUrl default value', () => {
    // When ENV is not set, it should fallback to localhost:1234/v1
    expect(config.providers.lmstudio.baseUrl).toBe("http://localhost:1234/v1");
  });
});
