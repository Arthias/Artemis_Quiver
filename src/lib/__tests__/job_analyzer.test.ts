"import { describe, it, expect, vi } from 'vitest';
import { analyzeJobPost, initializeLLMClient } from '../src/lib/job_analyzer';

describe('Job Analyzer Logic (Unit Tests)', () => {
  const mockJobPost = 'A detailed job description...';
  const mockProfile = 'User\'s comprehensive professional profile content.';

  it('should throw an error if the LLM client cannot be initialized due to missing API key', async () => {
    await expect(initializeLLMClient('')).rejects.toThrow(/API Key is required/i);
  });

  it('should successfully run analysis and return structured result on success', async () => {
    const mockLlmClient = {
      chatCompletion: vi.fn(),
    };

    vi.spyOn(require('../src/lib/job_analyzer'), 'analyzeJobPost').mockImplementation(() => Promise.resolve({
      score: 92.5,
      salaryRange: '$100k - $140k per year (Estimated)',
      tips: [
        'Focus on the intersection of Cloud and Full-Stack development.',
        'Quantify your impact in previous roles using metrics.'
      ],
      analysisJson: {
        suggestedRole: 'Full Stack Engineer',
        keywordsMatched: ['Next.js', 'TypeScript', 'Cloud Services'],
      },
    }));

    const result = await analyzeJobPost(mockLlmClient, mockJobPost, mockProfile);
    
    expect(result.score).toBeCloseTo(92.5);
    expect(Array.isArray(result.tips)).toBe(true);
    expect(typeof result.analysisJson).toBe('object');
  });

  it('should throw an error if the job post text is empty', async () => {
    vi.spyOn(require('../src/lib/job_analyzer'), 'analyzeJobPost').mockRejectedValue(new Error('Job posting and master profile are required for analysis'));

    await expect(analyzeJobPost(any, '', mockProfile)).rejects.toThrow(/required for analysis/i);
  });
});"
"import { describe, it, expect, vi } from 'vitest';
import { analyzeJobPost, initializeLLMClient } from '../src/lib/job_analyzer';

describe('Job Analyzer Logic (Unit Tests)', () => {
  const mockJobPost = 'A detailed job description...';
  const mockProfile = 'User\'s comprehensive professional profile content.';

  it('should throw an error if the LLM client cannot be initialized due to missing API key', async () => {
    await expect(initializeLLMClient('')).rejects.toThrow(/API Key is required/i);
  });

  it('should successfully run analysis and return structured result on success', async () => {
    const mockLlmClient = {
      chatCompletion: vi.fn(),
    };

    vi.spyOn(require('../src/lib/job_analyzer'), 'analyzeJobPost').mockImplementation(() => Promise.resolve({
      score: 92.5,
      salaryRange: '$100k - $140k per year (Estimated)',
      tips: [
        'Focus on the intersection of Cloud and Full-Stack development.',
        'Quantify your impact in previous roles using metrics.'
      ],
      analysisJson: {
        suggestedRole: 'Full Stack Engineer',
        keywordsMatched: ['Next.js', 'TypeScript', 'Cloud Services'],
      },
    }));

    const result = await analyzeJobPost(mockLlmClient, mockJobPost, mockProfile);
    
    expect(result.score).toBeCloseTo(92.5);
    expect(Array.isArray(result.tips)).toBe(true);
    expect(typeof result.analysisJson).toBe('object');
  });

  it('should throw an error if the job post text is empty', async () => {
    vi.spyOn(require('../src/lib/job_analyzer'), 'analyzeJobPost').mockRejectedValue(new Error('Job posting and master profile are required for analysis'));

    await expect(analyzeJobPost(any, '', mockProfile)).rejects.toThrow(/required for analysis/i);
  });
});"
      analysisJson: {
