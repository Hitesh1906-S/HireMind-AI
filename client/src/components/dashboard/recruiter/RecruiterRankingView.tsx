'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Trophy,
  Sliders,
  Sparkles,
  Search,
  CheckCircle2,
  XCircle,
  Calendar,
  FileText,
  HelpCircle,
  RefreshCw,
  Save,
  AlertTriangle,
  Info,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  UserCheck,
  ArrowUpDown,
  ExternalLink,
  Download,
} from 'lucide-react';
import { RankingApi } from '@/lib/api-ranking';
import { JobApi } from '@/lib/api-jobs';
import {
  RankingWeights,
  CandidateRankRecord,
  JobRankingResponse,
  ScoreContribution,
  DEFAULT_RANKING_WEIGHTS,
} from '@/types/ranking';
import { Job } from '@/types/job';
import { useToast } from '@/context/ToastContext';
import { Avatar } from '@/components/ui/avatar';
import { Dialog } from '@/components/ui/dialog';
import { CandidateReportModal } from './CandidateReportModal';

interface Props {
  initialJobId?: string;
  onNavigateToInterview?: (candidateId: string, jobId?: string) => void;
}

export const RecruiterRankingView: React.FC<Props> = ({
  initialJobId,
  onNavigateToInterview,
}) => {
  const { success, error } = useToast();

  // Job selection state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>(initialJobId || '');
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);

  // Weights configuration state
  const [weights, setWeights] = useState<RankingWeights>(DEFAULT_RANKING_WEIGHTS);
  const [isSavingWeights, setIsSavingWeights] = useState(false);
  const [showWeightsPanel, setShowWeightsPanel] = useState(true);

  // Ranking data state
  const [rankingData, setRankingData] = useState<JobRankingResponse | null>(null);
  const [isLoadingRankings, setIsLoadingRankings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRecommendation, setFilterRecommendation] = useState<string>('ALL');

  // Breakdown modal state
  const [selectedCandidateBreakdown, setSelectedCandidateBreakdown] =
    useState<CandidateRankRecord | null>(null);

  // Add Notes modal state
  const [candidateForNotes, setCandidateForNotes] = useState<CandidateRankRecord | null>(null);
  const [notesInput, setNotesInput] = useState('');
  const [isSubmittingNotes, setIsSubmittingNotes] = useState(false);

  // Candidate Report modal state
  const [selectedReportCandidate, setSelectedReportCandidate] =
    useState<CandidateRankRecord | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Action execution state
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  // 1. Fetch active jobs
  useEffect(() => {
    async function loadJobs() {
      try {
        setIsLoadingJobs(true);
        const res = await JobApi.getJobs();
        const activeJobs = res.jobs.filter((j) => j.status === 'ACTIVE' || j.status === 'DRAFT');
        setJobs(activeJobs);
        if (!selectedJobId && activeJobs.length > 0) {
          setSelectedJobId(activeJobs[0].id);
        }
      } catch (err: any) {
        error(err.message || 'Failed to load jobs list.');
      } finally {
        setIsLoadingJobs(false);
      }
    }
    loadJobs();
  }, [selectedJobId, error]);

  // 2. Fetch Rankings
  const fetchRankings = useCallback(
    async (jobId: string, currentWeights: RankingWeights) => {
      if (!jobId) return;
      try {
        setIsLoadingRankings(true);
        const data = await RankingApi.getJobRankings(jobId, currentWeights);
        setRankingData(data);
        if (data.weights) {
          setWeights((prev) => {
            const hasChanged =
              prev.resumeWeight !== data.weights.resumeWeight ||
              prev.codingWeight !== data.weights.codingWeight ||
              prev.technicalWeight !== data.weights.technicalWeight ||
              prev.communicationWeight !== data.weights.communicationWeight ||
              prev.otherWeight !== data.weights.otherWeight;
            return hasChanged ? data.weights : prev;
          });
        }
      } catch (err: any) {
        error(err.message || 'Failed to fetch candidate rankings.');
      } finally {
        setIsLoadingRankings(false);
      }
    },
    [error]
  );

  const weightsRef = useRef(weights);
  weightsRef.current = weights;

  useEffect(() => {
    if (selectedJobId) {
      fetchRankings(selectedJobId, weightsRef.current);
    }
  }, [selectedJobId, fetchRankings]);

  // Handle Weight Slider Changes
  const handleWeightChange = (key: keyof RankingWeights, value: number) => {
    const updated = {
      ...weights,
      [key]: value,
    };
    setWeights(updated);
    if (selectedJobId) {
      fetchRankings(selectedJobId, updated);
    }
  };

  // Reset Weights
  const handleResetWeights = () => {
    setWeights(DEFAULT_RANKING_WEIGHTS);
    if (selectedJobId) {
      fetchRankings(selectedJobId, DEFAULT_RANKING_WEIGHTS);
    }
    success('Weights reset to standard defaults.');
  };

  // Save weights as job default
  const handleSaveWeights = async () => {
    if (!selectedJobId) return;
    try {
      setIsSavingWeights(true);
      await RankingApi.saveJobWeights(selectedJobId, weights);
      success('Ranking weights saved for this job requisition.');
    } catch (err: any) {
      error(err.message || 'Failed to save weights.');
    } finally {
      setIsSavingWeights(false);
    }
  };

  // Pipeline Actions (Shortlist, Reject, Move to Interview)
  const handleExecuteAction = async (
    applicationId: string,
    action: 'SHORTLIST' | 'REJECT' | 'MOVE_TO_INTERVIEW'
  ) => {
    try {
      setActionInProgressId(applicationId);
      const res = await RankingApi.executeCandidateAction(applicationId, action);
      success(`Candidate ${res.candidateName} updated: ${action.replace('_', ' ')}`);
      // Refresh rankings
      if (selectedJobId) {
        fetchRankings(selectedJobId, weights);
      }
    } catch (err: any) {
      error(err.message || `Failed to perform action on candidate.`);
    } finally {
      setActionInProgressId(null);
    }
  };

  // Submit Recruiter Notes
  const handleSubmitNotes = async () => {
    if (!candidateForNotes || !notesInput.trim()) return;
    try {
      setIsSubmittingNotes(true);
      await RankingApi.executeCandidateAction(
        candidateForNotes.applicationId,
        'ADD_NOTES',
        notesInput.trim()
      );
      success(`Note saved for ${candidateForNotes.name}.`);
      setCandidateForNotes(null);
      setNotesInput('');
      if (selectedJobId) {
        fetchRankings(selectedJobId, weights);
      }
    } catch (err: any) {
      error(err.message || 'Failed to save recruiter note.');
    } finally {
      setIsSubmittingNotes(false);
    }
  };

  // Total weight calculation
  const totalWeight =
    weights.resumeWeight +
    weights.codingWeight +
    weights.technicalWeight +
    weights.communicationWeight +
    weights.otherWeight;

  const isTotalWeight100 = totalWeight === 100;

  // Filtered Candidates
  const filteredCandidates = (rankingData?.rankings || []).filter((cand) => {
    const matchesSearch =
      cand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cand.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cand.headline.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRec =
      filterRecommendation === 'ALL' || cand.recommendation === filterRecommendation;

    return matchesSearch && matchesRec;
  });

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400';
    if (score >= 70) return 'text-indigo-400';
    if (score >= 55) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getScoreBadgeBg = (score: number) => {
    if (score >= 85) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    if (score >= 70) return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
    if (score >= 55) return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 font-black text-xs shadow-lg shadow-amber-500/20">
          🥇 1
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-300/20 text-slate-200 border border-slate-300/50 font-black text-xs shadow-md">
          🥈 2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-700/20 text-amber-400 border border-amber-700/50 font-black text-xs">
          🥉 3
        </span>
      );
    }
    return (
      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono text-xs font-bold">
        #{rank}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-xl shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-indigo-500/20 border border-amber-500/30 text-amber-400">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Candidate Ranking Engine
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Deterministic Math
                </span>
              </h1>
              <p className="text-sm text-slate-400">
                Transparent multi-factor ranking calibrated with recruiter-configurable weights. Zero AI hallucinations.
              </p>
            </div>
          </div>
        </div>

        {/* Job Requisition Selector */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <label className="text-[11px] font-semibold text-slate-400 mb-1">Target Requisition</label>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 min-w-[240px]"
            >
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} ({job.department})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowWeightsPanel(!showWeightsPanel)}
            className={`mt-4 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
              showWeightsPanel
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Sliders className="h-4 w-4" />
            Configure Weights
          </button>
        </div>
      </div>

      {/* Ethical AI & Merit Safeguard Notice */}
      <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <span className="font-bold text-white">Merit-Based Transparency Guarantee:</span> HireMind AI ranks candidates exclusively on stored objective criteria: Resume alignment, coding execution, technical interview rubric scores, and communication clarity. Protected personal characteristics (gender, race, age, religion, location) are strictly excluded from all calculations.
        </div>
      </div>

      {/* Configurable Weighting Panel */}
      {showWeightsPanel && (
        <div className="bg-slate-900/80 p-5 rounded-2xl border border-indigo-500/20 backdrop-blur-xl shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Custom Scoring Weights</h3>
              <span className="text-xs text-slate-400">
                Adjust the importance of each factor for this requisition
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                  isTotalWeight100
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                Sum: {totalWeight}% {isTotalWeight100 ? '✓ (Normalized)' : '(Will be normalized to 100%)'}
              </span>

              <button
                onClick={handleResetWeights}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                title="Reset to 20/30/25/15/10 standard defaults"
              >
                <RefreshCw className="h-3 w-3" /> Reset Defaults
              </button>

              <button
                onClick={handleSaveWeights}
                disabled={isSavingWeights}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {isSavingWeights ? 'Saving...' : 'Save for Job'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-1">
            {/* 1. Resume Fit Weight */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-300">Resume Fit</span>
                <span className="font-mono font-bold text-indigo-400">{weights.resumeWeight}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={weights.resumeWeight}
                onChange={(e) => handleWeightChange('resumeWeight', Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <p className="text-[10px] text-slate-500">Skills, experience, & education relevance</p>
            </div>

            {/* 2. Coding Weight */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-300">Coding Test</span>
                <span className="font-mono font-bold text-indigo-400">{weights.codingWeight}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={weights.codingWeight}
                onChange={(e) => handleWeightChange('codingWeight', Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <p className="text-[10px] text-slate-500">Live sandbox execution & test cases</p>
            </div>

            {/* 3. Technical Interview Weight */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-300">Technical Interview</span>
                <span className="font-mono font-bold text-indigo-400">{weights.technicalWeight}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={weights.technicalWeight}
                onChange={(e) => handleWeightChange('technicalWeight', Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <p className="text-[10px] text-slate-500">Architecture, depth, & rubric evaluation</p>
            </div>

            {/* 4. Communication Weight */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-300">Communication</span>
                <span className="font-mono font-bold text-indigo-400">{weights.communicationWeight}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={weights.communicationWeight}
                onChange={(e) => handleWeightChange('communicationWeight', Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <p className="text-[10px] text-slate-500">Verbal articulation & relevance metrics</p>
            </div>

            {/* 5. Other Factors Weight */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-300">Other Factors</span>
                <span className="font-mono font-bold text-indigo-400">{weights.otherWeight}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={weights.otherWeight}
                onChange={(e) => handleWeightChange('otherWeight', Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <p className="text-[10px] text-slate-500">Problem solving & job skill alignment</p>
            </div>
          </div>
        </div>
      )}

      {/* KPI Stats Bar */}
      {rankingData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Ranked</span>
            <div className="text-2xl font-black text-white mt-1">{rankingData.totalCandidates}</div>
            <span className="text-[11px] text-slate-500">In this requisition</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Average Score</span>
            <div className={`text-2xl font-black mt-1 ${getScoreColor(rankingData.averageScore)}`}>
              {rankingData.averageScore}%
            </div>
            <span className="text-[11px] text-slate-500">Deterministic mean</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Top Score</span>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              {rankingData.highestScore}%
            </div>
            <span className="text-[11px] text-slate-500">Rank #1 candidate</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Minimum Score</span>
            <div className="text-2xl font-black text-slate-400 mt-1">
              {rankingData.lowestScore}%
            </div>
            <span className="text-[11px] text-slate-500">Lowest candidate in pool</span>
          </div>
        </div>
      )}

      {/* Search & Recommendation Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search candidate by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs text-slate-400 whitespace-nowrap">Filter Recommendation:</span>
          {['ALL', 'STRONG_HIRE', 'HIRE', 'MAYBE', 'NO_HIRE'].map((rec) => (
            <button
              key={rec}
              onClick={() => setFilterRecommendation(rec)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                filterRecommendation === rec
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {rec === 'ALL' ? 'All Candidates' : rec.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Rankings Table */}
      <div className="bg-slate-900/70 rounded-2xl border border-slate-800 backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-4 w-16 text-center">Rank</th>
                <th className="p-4">Candidate</th>
                <th className="p-4 text-center">Resume Fit</th>
                <th className="p-4 text-center">Coding</th>
                <th className="p-4 text-center">Technical</th>
                <th className="p-4 text-center">Communication</th>
                <th className="p-4 text-center">Overall</th>
                <th className="p-4 text-center">Recommendation</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoadingRankings ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" />
                      <span>Computing deterministic candidate rankings...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertTriangle className="h-8 w-8 text-slate-600" />
                      <p className="text-sm">No candidates found matching the selected filters.</p>
                      <span className="text-xs text-slate-600">
                        Try resetting the recommendation filter or search term.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCandidates.map((cand) => (
                  <tr
                    key={cand.applicationId}
                    className="hover:bg-slate-800/40 transition-colors group"
                  >
                    {/* Rank */}
                    <td className="p-4 text-center">
                      <div className="flex justify-center">{getRankBadge(cand.rank)}</div>
                    </td>

                    {/* Candidate */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={cand.avatar || undefined}
                          name={cand.name}
                          size="md"
                          className="border border-slate-700"
                        />
                        <div>
                          <div className="font-bold text-white group-hover:text-indigo-300 transition-colors">
                            {cand.name}
                          </div>
                          <div className="text-xs text-slate-400">{cand.email}</div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                            {cand.headline}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Resume Score */}
                    <td className="p-4 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-md border text-xs font-mono font-bold ${getScoreBadgeBg(cand.resumeScore)}`}>
                        {cand.resumeScore}%
                      </span>
                    </td>

                    {/* Coding Score */}
                    <td className="p-4 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-md border text-xs font-mono font-bold ${getScoreBadgeBg(cand.codingScore)}`}>
                        {cand.codingScore}%
                      </span>
                    </td>

                    {/* Technical Score */}
                    <td className="p-4 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-md border text-xs font-mono font-bold ${getScoreBadgeBg(cand.technicalScore)}`}>
                        {cand.technicalScore}%
                      </span>
                    </td>

                    {/* Communication Score */}
                    <td className="p-4 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-md border text-xs font-mono font-bold ${getScoreBadgeBg(cand.communicationScore)}`}>
                        {cand.communicationScore}%
                      </span>
                    </td>

                    {/* Overall Score + Breakdown Button */}
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`text-base font-black font-mono ${getScoreColor(cand.overallScore)}`}>
                          {cand.overallScore}%
                        </span>
                        <button
                          onClick={() => setSelectedCandidateBreakdown(cand)}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 underline flex items-center gap-0.5"
                          title="View mathematical score contribution formula"
                        >
                          Breakdown
                        </button>
                      </div>
                    </td>

                    {/* Recommendation Badge */}
                    <td className="p-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${
                          cand.recommendation === 'STRONG_HIRE'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : cand.recommendation === 'HIRE'
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                            : cand.recommendation === 'MAYBE'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {cand.recommendation.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Shortlist */}
                        <button
                          onClick={() => handleExecuteAction(cand.applicationId, 'SHORTLIST')}
                          disabled={actionInProgressId === cand.applicationId || cand.status === 'SHORTLISTED'}
                          className={`p-1.5 rounded-lg border text-xs transition-all ${
                            cand.status === 'SHORTLISTED'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 cursor-default'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-emerald-600 hover:text-white hover:border-emerald-500'
                          }`}
                          title="Shortlist Candidate"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>

                        {/* Move to Interview */}
                        <button
                          onClick={() => {
                            handleExecuteAction(cand.applicationId, 'MOVE_TO_INTERVIEW');
                            if (onNavigateToInterview) {
                              onNavigateToInterview(cand.candidateId, selectedJobId);
                            }
                          }}
                          disabled={actionInProgressId === cand.applicationId}
                          className="p-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-500 text-xs transition-all"
                          title="Move Candidate to Interview"
                        >
                          <Calendar className="h-4 w-4" />
                        </button>

                        {/* Reject */}
                        <button
                          onClick={() => handleExecuteAction(cand.applicationId, 'REJECT')}
                          disabled={actionInProgressId === cand.applicationId || cand.status === 'REJECTED'}
                          className={`p-1.5 rounded-lg border text-xs transition-all ${
                            cand.status === 'REJECTED'
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 cursor-default'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-rose-600 hover:text-white hover:border-rose-500'
                          }`}
                          title="Reject Candidate"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>

                        {/* Add Notes */}
                        <button
                          onClick={() => {
                            setCandidateForNotes(cand);
                            setNotesInput(cand.notes || '');
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 text-xs transition-all"
                          title="View / Add Recruiter Notes"
                        >
                          <FileText className="h-4 w-4" />
                        </button>

                        {/* Download / View 15-Section Evaluation Report */}
                        <button
                          onClick={() => {
                            setSelectedReportCandidate(cand);
                            setIsReportModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-indigo-950/60 text-indigo-300 border border-indigo-700/60 hover:bg-indigo-600 hover:text-white hover:border-indigo-500 text-xs transition-all"
                          title="View 15-Section Evaluation Dossier & Download PDF"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Score Breakdown Modal */}
      {selectedCandidateBreakdown && (
        <Dialog
          isOpen={true}
          onClose={() => setSelectedCandidateBreakdown(null)}
          title={`Deterministic Score Breakdown: ${selectedCandidateBreakdown.name}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-400">Total Calibrated Score</span>
                <span className={`text-2xl font-black ${getScoreColor(selectedCandidateBreakdown.overallScore)}`}>
                  {selectedCandidateBreakdown.overallScore}%
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Formula: <code className="text-indigo-300 bg-slate-900 px-1.5 py-0.5 rounded">Overall Score = ∑ (Raw Score × Weight%) / ∑ Weights</code>
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Evaluation Dimension</th>
                    <th className="p-3 text-center">Raw Score</th>
                    <th className="p-3 text-center">Weight</th>
                    <th className="p-3 text-right">Points Contributed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {selectedCandidateBreakdown.breakdown.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="p-3 font-semibold text-white">{item.dimension}</td>
                      <td className="p-3 text-center font-mono font-bold text-slate-300">
                        {item.rawScore}%
                      </td>
                      <td className="p-3 text-center font-mono text-indigo-400">
                        {item.weightPercentage}%
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-400">
                        +{item.weightedContribution}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-950/60 font-bold border-t border-slate-800">
                    <td className="p-3 text-white">Final Deterministic Score</td>
                    <td className="p-3 text-center">-</td>
                    <td className="p-3 text-center font-mono text-indigo-300">100%</td>
                    <td className="p-3 text-right font-mono text-emerald-400 text-sm">
                      {selectedCandidateBreakdown.overallScore}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {selectedCandidateBreakdown.notes && (
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-1">
                <span className="font-bold text-slate-300">Recruiter Notes:</span>
                <p className="text-slate-400 whitespace-pre-line">{selectedCandidateBreakdown.notes}</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedCandidateBreakdown(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Add / Edit Notes Modal */}
      {candidateForNotes && (
        <Dialog
          isOpen={true}
          onClose={() => setCandidateForNotes(null)}
          title={`Recruiter Notes: ${candidateForNotes.name}`}
          maxWidth="lg"
        >
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Evaluation Notes & Next Steps
              </label>
              <textarea
                rows={5}
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="Add notes about candidate interview performance, team culture fit, or follow-up items..."
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCandidateForNotes(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitNotes}
                disabled={isSubmittingNotes}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg disabled:opacity-50"
              >
                {isSubmittingNotes ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Candidate 15-Section Evaluation Report Dossier Modal */}
      <CandidateReportModal
        interviewId={selectedReportCandidate?.interviewId}
        applicationId={selectedReportCandidate?.applicationId}
        candidateName={selectedReportCandidate?.name}
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />
    </div>
  );
};
