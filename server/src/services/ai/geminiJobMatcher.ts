import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  IAiJobMatcher,
  JobMatchInput,
  CandidateMatchInput,
} from './jobMatcher.interface.js';
import {
  JobMatchResult,
  jobMatchResultSchema,
} from '../../validations/jobMatch.schema.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { MockJobMatcher } from './mockJobMatcher.js';

export class GeminiJobMatcher implements IAiJobMatcher {
  private fallbackMatcher = new MockJobMatcher();

  private sanitizeJsonText(rawJson: string): string {
    let clean = rawJson.trim();
    if (clean.startsWith('```json')) {
      clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    return clean.trim();
  }

  async matchCandidateToJob(
    job: JobMatchInput,
    candidate: CandidateMatchInput
  ): Promise<JobMatchResult> {
    if (!env.GEMINI_API_KEY) {
      console.warn(
        '[GeminiJobMatcher] GEMINI_API_KEY not set. Using intelligent fallback job matcher.'
      );
      return this.fallbackMatcher.matchCandidateToJob(job, candidate);
    }

    try {
      const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
      const modelName = env.AI_MODEL || 'gemini-1.5-flash';
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      });

      const prompt = `You are an expert recruitment AI assistant evaluating a candidate against a specific job opening.
Calculate a transparent, explainable compatibility score (0-100) and detailed suitability assessment.

CRITICAL POLICY: This analysis is an advisory decision-support evaluation for human recruiters. You must NOT make definitive or irreversible hiring decisions.

EVALUATION RUBRIC & WEIGHTS:
1. Required skill match (35% weight): Compare candidate skills and demonstrated experience against the job's required skills.
2. Preferred skill match (15% weight): Assess any bonus or preferred skills.
3. Experience relevance (25% weight): Compare candidate's career trajectory, years of experience, and role depth against the job's target experience level (${job.experienceLevel}).
4. Education relevance (10% weight): Check degree relevance and academic background against position requirements.
5. Project relevance (15% weight): Review candidate's portfolio projects and practical technology usage.

OVERALL SCORE CALCULATION:
overallScore = round(requiredSkillScore * 0.35 + experienceScore * 0.25 + preferredSkillScore * 0.15 + projectScore * 0.15 + educationScore * 0.10) (0 to 100)

RECOMMENDATION RULES:
- "STRONG_MATCH": overallScore >= 85
- "GOOD_MATCH": 70 <= overallScore < 85
- "PARTIAL_MATCH": 50 <= overallScore < 70
- "WEAK_MATCH": overallScore < 50

JOB REQUIREMENTS:
Title: ${job.title}
Department: ${job.department}
Experience Level: ${job.experienceLevel}
Required Skills: ${JSON.stringify(job.requiredSkills)}
Preferred Skills: ${JSON.stringify(job.preferredSkills)}
Description: ${job.description}
Responsibilities: ${job.responsibilities}

CANDIDATE PROFILE:
Name: ${candidate.fullName || 'Candidate'}
Headline: ${candidate.headline || 'N/A'}
Summary: ${candidate.summary || 'N/A'}
Years of Experience: ${candidate.yearsOfExperience ?? 0}
Skills: ${JSON.stringify(candidate.skills.map((s) => s.name))}
Work Experience: ${JSON.stringify(candidate.workExperiences)}
Education: ${JSON.stringify(candidate.educations)}
Projects: ${JSON.stringify(candidate.projects)}
${candidate.resumeText ? `Raw Resume Excerpt: ${candidate.resumeText.slice(0, 1500)}` : ''}

REQUIRED JSON OUTPUT FORMAT:
{
  "overallScore": number (0-100),
  "matchedSkills": string[] (skills matching job requirements),
  "missingSkills": string[] (required skills not demonstrated by candidate),
  "strengths": string[] (3-5 concrete strengths relevant to this job),
  "weaknesses": string[] (2-4 concrete areas of gap or growth needed),
  "experienceMatch": {
    "score": number (0-100),
    "summary": string (clear summary of experience depth vs requirement),
    "candidateYears": number,
    "requiredLevel": string,
    "relevanceExplanation": string
  },
  "recommendation": "STRONG_MATCH" | "GOOD_MATCH" | "PARTIAL_MATCH" | "WEAK_MATCH",
  "summary": string (concise executive overview of match),
  "scoringBreakdown": {
    "requiredSkills": { "weight": 35, "score": number, "details": string },
    "experience": { "weight": 25, "score": number, "details": string },
    "preferredSkills": { "weight": 15, "score": number, "details": string },
    "projects": { "weight": 15, "score": number, "details": string },
    "education": { "weight": 10, "score": number, "details": string }
  },
  "disclaimer": "This AI compatibility evaluation is an advisory decision-support tool. It does not constitute an automated hiring decision. All employment actions must be reviewed and decided by authorized human recruiters."
}

Return ONLY valid JSON matching this schema.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const cleaned = this.sanitizeJsonText(text);
      const parsedJson = JSON.parse(cleaned);

      // Validate output with Zod
      const validated = jobMatchResultSchema.parse(parsedJson);
      return validated;
    } catch (error: any) {
      logger.error(
        '[GeminiJobMatcher] Error calling Gemini API or validating output:',
        error?.message || error
      );
      logger.info('[GeminiJobMatcher] Falling back to intelligent job matcher.');
      return this.fallbackMatcher.matchCandidateToJob(job, candidate);
    }
  }
}
