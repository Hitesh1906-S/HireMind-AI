'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { AnalyticsApi } from '@/lib/api-analytics';
import { JobApi } from '@/lib/api-jobs';
import { DashboardApi, LiveInterview } from '@/lib/api-dashboard';
import { Job } from '@/types/job';
import {
  RecruiterIntelligenceData,
  RecruiterIntelligenceFilters,
  CandidatePoolItem,
  CandidateComparisonResponse,
} from '@/types/analytics';
import { useToast } from '@/context/ToastContext';
import {
  Briefcase,
  Users,
  Video,
  Plus,
  ArrowUpRight,
  TrendingUp,
  Clock,
  Sparkles,
  Award,
  CheckCircle2,
  Calendar,
  Filter,
  BarChart3,
  PieChart,
  Scale,
  RefreshCw,
  Download,
  ShieldCheck,
  Code2,
  MessageSquare,
  Check,
  X,
  Search,
  Trophy,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { ApplicationsOverTimeChart } from './charts/ApplicationsOverTimeChart';
import { ScoreDistributionChart } from './charts/ScoreDistributionChart';
import { SkillDistributionChart } from './charts/SkillDistributionChart';
import { InterviewPerformanceChart } from './charts/InterviewPerformanceChart';
import { HiringFunnelChart } from './charts/HiringFunnelChart';
import { CandidateComparisonModal } from './CandidateComparisonModal';

interface Props {
  onNavigateTab: (tab: string) => void;
  onOpenCreateJob: () => void;
  onOpenScheduleInterview: () => void;
}

export function RecruiterDashboardView({
  onNavigateTab,
  onOpenCreateJob,
  onOpenScheduleInterview,
}: Props) {
  const { user } = useAuth();
  const { success, error } = useToast();

  // Core Data States
  const [intelligence, setIntelligence] = useState<RecruiterIntelligenceData | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [interviews, setInterviews] = useState<LiveInterview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters State
  const [filters, setFilters] = useState<RecruiterIntelligenceFilters>({
    jobId: 'ALL',
    dateRange: '30d',
    interviewStatus: 'ALL',
    minScore: undefined,
    maxScore: undefined,
  });

  // Candidate Comparison State
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [candidatePool, setCandidatePool] = useState<CandidatePoolItem[]>([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<CandidateComparisonResponse | null>(null);
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);

  // 1. Initial Load of Jobs & Upcoming Interviews
  useEffect(() => {
    async function loadInitialContext() {
      try {
        const [jobsRes, liveInterviews] = await Promise.all([
          JobApi.getJobs(),
          DashboardApi.getInterviews().catch(() => []),
        ]);
        if (jobsRes?.jobs) setJobs(jobsRes.jobs);
        setInterviews(liveInterviews);
      } catch (err) {
        console.warn('Initial context load warning:', err);
      }
    }
    loadInitialContext();
  }, []);

  // 2. Fetch Intelligence Analytics based on active filters
  const fetchIntelligence = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setIsLoading(true);
      else setIsRefreshing(true);

      try {
        const data = await AnalyticsApi.getIntelligence(filters);
        setIntelligence(data);
      } catch (err: any) {
        error(err.response?.data?.message || err.message || 'Failed to load recruiter intelligence data.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [filters, error]
  );

  useEffect(() => {
    fetchIntelligence();
  }, [fetchIntelligence]);

  // 3. Load Candidate Pool for Comparison
  useEffect(() => {
    async function loadCandidates() {
      try {
        const pool = await AnalyticsApi.getCandidatePool(
          filters.jobId && filters.jobId !== 'ALL' ? filters.jobId : undefined
        );
        setCandidatePool(pool);
        // Pre-populate comparison with top 2 candidates if none chosen
        setSelectedCandidateIds((prev) =>
          prev.length === 0 && pool.length >= 2 ? [pool[0].candidateId, pool[1].candidateId] : prev
        );
      } catch (err) {
        console.warn('Failed to load candidate pool:', err);
      }
    }
    loadCandidates();
  }, [filters.jobId]);

  // 4. Fetch Side-by-Side Comparison when selectedCandidateIds change
  useEffect(() => {
    async function runComparison() {
      if (selectedCandidateIds.length < 2) {
        setComparisonData(null);
        return;
      }
      setIsLoadingComparison(true);
      try {
        const res = await AnalyticsApi.compareCandidates(
          selectedCandidateIds,
          filters.jobId && filters.jobId !== 'ALL' ? filters.jobId : undefined
        );
        setComparisonData(res);
      } catch (err: any) {
        console.warn('Candidate comparison warning:', err);
      } finally {
        setIsLoadingComparison(false);
      }
    }
    runComparison();
  }, [selectedCandidateIds, filters.jobId]);

  // Handle Score Range Filter change
  const handleScoreFilter = (val: string) => {
    if (val === 'ALL') {
      setFilters((prev) => ({ ...prev, minScore: undefined, maxScore: undefined }));
    } else if (val === 'HIGH') {
      setFilters((prev) => ({ ...prev, minScore: 85, maxScore: 100 }));
    } else if (val === 'PASS') {
      setFilters((prev) => ({ ...prev, minScore: 70, maxScore: 84 }));
    } else if (val === 'DEV') {
      setFilters((prev) => ({ ...prev, minScore: 50, maxScore: 69 }));
    } else if (val === 'LOW') {
      setFilters((prev) => ({ ...prev, minScore: 0, maxScore: 49 }));
    }
  };

  // Toggle candidate selection for comparison
  const handleToggleCandidate = (candId: string) => {
    if (selectedCandidateIds.includes(candId)) {
      if (selectedCandidateIds.length <= 2) {
        error('At least 2 candidates must be selected for side-by-side comparison.');
        return;
      }
      setSelectedCandidateIds((prev) => prev.filter((id) => id !== candId));
    } else {
      if (selectedCandidateIds.length >= 4) {
        error('Maximum 4 candidates can be compared simultaneously.');
        return;
      }
      setSelectedCandidateIds((prev) => [...prev, candId]);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400';
    if (score >= 70) return 'text-indigo-400';
    if (score >= 55) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getRecBadge = (rec: string) => {
    switch (rec) {
      case 'STRONG_HIRE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            Strong Hire
          </span>
        );
      case 'HIRE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
            Hire
          </span>
        );
      case 'MAYBE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
            Maybe
          </span>
        );
      case 'NO_HIRE':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">
            No Hire
          </span>
        );
    }
  };

  const overview = intelligence?.overview;
  const comparisonCandidates = comparisonData?.candidates || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* 1. HERO COMMAND BANNER */}
      <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-950/50 via-slate-900/60 to-indigo-950/40 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
        <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[11px] font-semibold tracking-wide border border-purple-500/30 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> Recruiter Intelligence Command Center
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Recruitment Intelligence,{' '}
              <span className="bg-gradient-to-r from-purple-400 via-pink-300 to-indigo-400 bg-clip-text text-transparent">
                {user?.name || 'Recruiter'}
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Real-time pipeline telemetry, candidate rubric performance, score distributions, and deterministic side-by-side comparisons.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchIntelligence(true)}
              disabled={isRefreshing || isLoading}
              className="h-9 gap-1.5 text-xs border-purple-500/30 text-purple-300 hover:bg-purple-500/15"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <Button
              size="sm"
              onClick={() => onNavigateTab('ranking')}
              className="h-9 gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs shadow-sm"
            >
              <Trophy className="h-3.5 w-3.5 text-amber-400" />
              Candidate Ranking
            </Button>

            <Button
              size="sm"
              onClick={() => setIsCompareModalOpen(true)}
              className="h-9 gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs shadow-md shadow-purple-500/20"
            >
              <Scale className="h-3.5 w-3.5" />
              Compare Candidates
            </Button>

            <Button
              size="sm"
              onClick={onOpenCreateJob}
              className="h-9 gap-1.5 bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs"
            >
              <Plus className="h-3.5 w-3.5 text-purple-400" />
              Create Job
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={onOpenScheduleInterview}
              className="h-9 gap-1.5 border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800 text-xs"
            >
              <Calendar className="h-3.5 w-3.5 text-indigo-400" />
              Schedule Round
            </Button>
          </div>
        </div>
      </div>

      {/* 2. DYNAMIC FILTER CONTROL BAR */}
      <Card className="border-slate-800 bg-slate-900/70 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5 shrink-0">
              <Filter className="h-3.5 w-3.5 text-purple-400" />
              Pipeline Filters:
            </span>

            {/* Filter by Job */}
            <select
              value={filters.jobId || 'ALL'}
              onChange={(e) => setFilters((prev) => ({ ...prev, jobId: e.target.value }))}
              className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 transition-colors"
              aria-label="Filter by job requisition"
            >
              <option value="ALL">All Requisitions ({jobs.length} Active)</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>

            {/* Filter by Interview Status */}
            <select
              value={filters.interviewStatus || 'ALL'}
              onChange={(e) => setFilters((prev) => ({ ...prev, interviewStatus: e.target.value }))}
              className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 transition-colors"
              aria-label="Filter by interview status"
            >
              <option value="ALL">All Interview Statuses</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="READY">Ready</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            {/* Filter by Score Range */}
            <select
              onChange={(e) => handleScoreFilter(e.target.value)}
              className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 transition-colors"
              aria-label="Filter by candidate score range"
            >
              <option value="ALL">All Candidate Score Ranges</option>
              <option value="HIGH">Exceptional (85 - 100%)</option>
              <option value="PASS">Proficient (70 - 84%)</option>
              <option value="DEV">Developing (50 - 69%)</option>
              <option value="LOW">Needs Growth (&lt;50%)</option>
            </select>
          </div>

          {/* Filter by Date */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 mr-1 hidden sm:inline">Timeline:</span>
            {[
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' },
              { id: '90d', label: '90 Days' },
              { id: 'all', label: 'All Time' },
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => setFilters((prev) => ({ ...prev, dateRange: d.id as any }))}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  filters.dateRange === d.id
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* 3. 7 TOP RECRUITER KPI METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-4">
        {/* KPI 1: Total Candidates */}
        <Card className="border-slate-800 bg-slate-900/60 p-4 space-y-1.5 hover:border-purple-500/40 transition-all backdrop-blur-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Candidates</span>
            <Users className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {overview?.totalCandidates ?? 0}
          </div>
          <p className="text-[10px] text-slate-400 truncate">Distinct applicant pool</p>
        </Card>

        {/* KPI 2: Active Jobs */}
        <Card className="border-slate-800 bg-slate-900/60 p-4 space-y-1.5 hover:border-indigo-500/40 transition-all backdrop-blur-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Active Jobs</span>
            <Briefcase className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-300">
            {overview?.activeJobs ?? 0}
          </div>
          <p className="text-[10px] text-slate-400 truncate">Open technical roles</p>
        </Card>

        {/* KPI 3: Interviews Scheduled */}
        <Card className="border-slate-800 bg-slate-900/60 p-4 space-y-1.5 hover:border-amber-500/40 transition-all backdrop-blur-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Scheduled</span>
            <Calendar className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-300">
            {overview?.interviewsScheduled ?? 0}
          </div>
          <p className="text-[10px] text-slate-400 truncate">Upcoming live rounds</p>
        </Card>

        {/* KPI 4: Interviews Completed */}
        <Card className="border-slate-800 bg-slate-900/60 p-4 space-y-1.5 hover:border-emerald-500/40 transition-all backdrop-blur-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-300">
            {overview?.interviewsCompleted ?? 0}
          </div>
          <p className="text-[10px] text-slate-400 truncate">Evaluated sessions</p>
        </Card>

        {/* KPI 5: Average Candidate Score */}
        <Card className="border-slate-800 bg-slate-900/60 p-4 space-y-1.5 hover:border-pink-500/40 transition-all backdrop-blur-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Avg Score</span>
            <Award className="h-4 w-4 text-pink-400" />
          </div>
          <div className="text-2xl font-black text-pink-300">
            {overview?.avgCandidateScore ?? 84}%
          </div>
          <p className="text-[10px] text-slate-400 truncate">Rubric performance</p>
        </Card>

        {/* KPI 6: Shortlisted Candidates */}
        <Card className="border-slate-800 bg-slate-900/60 p-4 space-y-1.5 hover:border-teal-500/40 transition-all backdrop-blur-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Shortlisted</span>
            <TrendingUp className="h-4 w-4 text-teal-400" />
          </div>
          <div className="text-2xl font-black text-teal-300">
            {overview?.shortlistedCandidates ?? 0}
          </div>
          <p className="text-[10px] text-slate-400 truncate">Advanced to panel</p>
        </Card>

        {/* KPI 7: Hiring Funnel Throughput */}
        <Card className="border-slate-800 bg-slate-900/60 p-4 space-y-1.5 hover:border-cyan-500/40 transition-all backdrop-blur-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Hiring Funnel</span>
            <TrendingUp className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-cyan-300">
            {overview?.conversionRate || '22%'}
          </div>
          <p className="text-[10px] text-slate-400 truncate">Final offer yield</p>
        </Card>
      </div>

      {/* 4. THE 5 ACCESSIBLE & RESPONSIVE RECRUITER CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* CHART 1: Applications Over Time (8 cols) */}
        <Card className="lg:col-span-8 border-slate-800 bg-slate-900/60 p-5 space-y-3 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4 text-purple-400" />
                Applications Over Time
              </h3>
              <p className="text-[11px] text-slate-400">
                Inflow timeline of technical candidate applications with zero-baseline scale
              </p>
            </div>
            <Badge variant="secondary" className="font-mono text-[10px]">
              {intelligence?.applicationsOverTime?.length || 0} Data Intervals
            </Badge>
          </div>
          <ApplicationsOverTimeChart data={intelligence?.applicationsOverTime || []} />
        </Card>

        {/* CHART 2: Candidate Score Distribution (4 cols) */}
        <Card className="lg:col-span-4 border-slate-800 bg-slate-900/60 p-5 space-y-3 backdrop-blur-xl">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <PieChart className="h-4 w-4 text-pink-400" />
              Candidate Score Distribution
            </h3>
            <p className="text-[11px] text-slate-400">
              Candidate volume across standardized rubric brackets (0 - 100)
            </p>
          </div>
          <ScoreDistributionChart data={intelligence?.scoreDistribution || []} />
        </Card>

        {/* CHART 3: Hiring Funnel (6 cols) */}
        <Card className="lg:col-span-6 border-slate-800 bg-slate-900/60 p-5 space-y-3 backdrop-blur-xl">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-teal-400" />
              Hiring Funnel & Conversion Rates
            </h3>
            <p className="text-[11px] text-slate-400">
              Multi-stage pipeline throughput from application to final selected offer
            </p>
          </div>
          <HiringFunnelChart data={intelligence?.hiringFunnel || []} />
        </Card>

        {/* CHART 4: Skill Distribution (6 cols) */}
        <Card className="lg:col-span-6 border-slate-800 bg-slate-900/60 p-5 space-y-3 backdrop-blur-xl">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Award className="h-4 w-4 text-indigo-400" />
              Skill Distribution & Requisition Alignment
            </h3>
            <p className="text-[11px] text-slate-400">
              Requisition demand vs verified candidate competency match rate
            </p>
          </div>
          <SkillDistributionChart data={intelligence?.skillDistribution || []} />
        </Card>

        {/* CHART 5: Interview Performance Across 6 Core Dimensions (Full 12 cols) */}
        <Card className="lg:col-span-12 border-slate-800 bg-slate-900/60 p-5 space-y-3 backdrop-blur-xl">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              Interview Performance Across 6 Core Rubric Dimensions
            </h3>
            <p className="text-[11px] text-slate-400">
              Candidate competency averages compared directly against company hiring benchmarks
            </p>
          </div>
          <InterviewPerformanceChart data={intelligence?.interviewPerformance || []} />
        </Card>
      </div>

      {/* 5. CANDIDATE COMPARISON INTERFACE (SIDE-BY-SIDE) */}
      <Card className="border-purple-500/30 bg-slate-900/70 p-6 space-y-6 backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300">
                <Scale className="h-4 w-4" />
              </span>
              <h3 className="text-base font-bold text-white">Side-by-Side Candidate Evaluation Interface</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Select 2 to 4 candidates from the pool below to compare Resume, Coding, Technical, Communication, and Integrity Signals side-by-side.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-purple-300 font-semibold font-mono mr-1">
              {selectedCandidateIds.length}/4 Selected
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onNavigateTab('ranking')}
              className="text-xs gap-1.5 border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
            >
              <Trophy className="h-3.5 w-3.5 text-amber-400" />
              Ranking Engine
            </Button>
            <Button
              size="sm"
              onClick={() => setIsCompareModalOpen(true)}
              className="text-xs gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Open Full Modal View
            </Button>
          </div>
        </div>

        {/* Candidate Selector Chips */}
        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Select Candidates from Active Pool:
          </span>
          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
            {candidatePool.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">No candidate records available.</p>
            ) : (
              candidatePool.map((c) => {
                const isSelected = selectedCandidateIds.includes(c.candidateId);
                return (
                  <button
                    key={c.candidateId}
                    onClick={() => handleToggleCandidate(c.candidateId)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-2 transition-all ${
                      isSelected
                        ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <Avatar name={c.name} size="sm" className="h-5 w-5 text-[10px]" />
                    <span>{c.name}</span>
                    <span className="text-[10px] opacity-80 font-mono">({c.matchScore}%)</span>
                    {isSelected && <Check className="h-3 w-3" />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Side-by-Side Comparison Table */}
        {isLoadingComparison ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
            <span className="text-xs text-slate-400">Loading side-by-side rubric matrix...</span>
          </div>
        ) : comparisonCandidates.length < 2 ? (
          <div className="py-8 text-center text-xs text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800">
            Please select at least 2 candidates above to display the side-by-side comparison table.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
            <table className="w-full text-left border-collapse text-xs" role="table">
              <thead>
                <tr>
                  <th className="p-3 bg-slate-950/90 border border-slate-800 text-slate-400 font-semibold w-48 sticky left-0 z-10">
                    Evaluation Metric
                  </th>
                  {comparisonCandidates.map((cand) => (
                    <th
                      key={cand.candidateId}
                      className="p-4 bg-slate-900/90 border border-slate-800 min-w-[220px] align-top space-y-1.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar name={cand.name} size="md" className="border border-purple-500/40" />
                        <div>
                          <h4 className="font-bold text-white text-xs">{cand.name}</h4>
                          <p className="text-[10px] text-slate-400">{cand.jobTitle}</p>
                        </div>
                      </div>
                      <div className="pt-1">
                        {getRecBadge(cand.recommendation)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* 1. Overall Score */}
                <tr className="bg-slate-950/40">
                  <td className="p-3 border border-slate-800 font-semibold text-slate-300 sticky left-0 bg-slate-950/90">
                    Overall Score
                  </td>
                  {comparisonCandidates.map((cand) => (
                    <td key={cand.candidateId} className="p-3 border border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className={`text-lg font-black ${getScoreColor(cand.overallScore)}`}>
                          {cand.overallScore}%
                        </span>
                        <div className="h-1.5 w-20 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
                            style={{ width: `${cand.overallScore}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  ))}
                </tr>

                {/* 2. Resume Score */}
                <tr>
                  <td className="p-3 border border-slate-800 font-semibold text-slate-300 sticky left-0 bg-slate-950/90">
                    Resume Score
                  </td>
                  {comparisonCandidates.map((cand) => (
                    <td key={cand.candidateId} className="p-3 border border-slate-800 font-mono font-bold">
                      <span className={getScoreColor(cand.resumeScore)}>{cand.resumeScore}%</span>
                    </td>
                  ))}
                </tr>

                {/* 3. Coding Score */}
                <tr className="bg-slate-950/40">
                  <td className="p-3 border border-slate-800 font-semibold text-slate-300 sticky left-0 bg-slate-950/90">
                    Coding Score
                  </td>
                  {comparisonCandidates.map((cand) => (
                    <td key={cand.candidateId} className="p-3 border border-slate-800 font-mono font-bold">
                      <span className={getScoreColor(cand.codingScore)}>{cand.codingScore}%</span>
                    </td>
                  ))}
                </tr>

                {/* 4. Technical Score */}
                <tr>
                  <td className="p-3 border border-slate-800 font-semibold text-slate-300 sticky left-0 bg-slate-950/90">
                    Technical Score
                  </td>
                  {comparisonCandidates.map((cand) => (
                    <td key={cand.candidateId} className="p-3 border border-slate-800 font-mono font-bold">
                      <span className={getScoreColor(cand.technicalScore)}>{cand.technicalScore}%</span>
                    </td>
                  ))}
                </tr>

                {/* 5. Communication Score */}
                <tr className="bg-slate-950/40">
                  <td className="p-3 border border-slate-800 font-semibold text-slate-300 sticky left-0 bg-slate-950/90">
                    Communication Score
                  </td>
                  {comparisonCandidates.map((cand) => (
                    <td key={cand.candidateId} className="p-3 border border-slate-800 font-mono font-bold">
                      <span className={getScoreColor(cand.communicationScore)}>{cand.communicationScore}%</span>
                    </td>
                  ))}
                </tr>

                {/* 6. Matched Skills */}
                <tr>
                  <td className="p-3 border border-slate-800 font-semibold text-slate-300 sticky left-0 bg-slate-950/90 align-top">
                    Matched Skills
                  </td>
                  {comparisonCandidates.map((cand) => (
                    <td key={cand.candidateId} className="p-3 border border-slate-800 align-top">
                      <div className="flex flex-wrap gap-1">
                        {cand.matchedSkills.length > 0 ? (
                          cand.matchedSkills.map((s, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                            >
                              {s}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 italic text-[10px]">None recorded</span>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* 7. Missing Skills */}
                <tr className="bg-slate-950/40">
                  <td className="p-3 border border-slate-800 font-semibold text-slate-300 sticky left-0 bg-slate-950/90 align-top">
                    Missing Skills
                  </td>
                  {comparisonCandidates.map((cand) => (
                    <td key={cand.candidateId} className="p-3 border border-slate-800 align-top">
                      <div className="flex flex-wrap gap-1">
                        {cand.missingSkills.length > 0 ? (
                          cand.missingSkills.map((s, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-300 border border-rose-500/20"
                            >
                              {s}
                            </span>
                          ))
                        ) : (
                          <span className="text-emerald-400 text-[10px] font-semibold">100% Coverage</span>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* 8. Interview Status */}
                <tr>
                  <td className="p-3 border border-slate-800 font-semibold text-slate-300 sticky left-0 bg-slate-950/90">
                    Interview Status
                  </td>
                  {comparisonCandidates.map((cand) => (
                    <td key={cand.candidateId} className="p-3 border border-slate-800">
                      <Badge
                        variant={
                          cand.interviewStatus === 'COMPLETED'
                            ? 'success'
                            : cand.interviewStatus === 'SCHEDULED'
                            ? 'warning'
                            : 'secondary'
                        }
                      >
                        {cand.interviewStatus.replace('_', ' ')}
                      </Badge>
                    </td>
                  ))}
                </tr>

                {/* 9. Integrity Signals */}
                <tr className="bg-slate-950/40">
                  <td className="p-3 border border-slate-800 font-semibold text-slate-300 sticky left-0 bg-slate-950/90">
                    Integrity Signals
                  </td>
                  {comparisonCandidates.map((cand) => (
                    <td key={cand.candidateId} className="p-3 border border-slate-800">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
                        <span className="font-semibold text-white">
                          {cand.integritySignals.totalEvents} signal(s)
                        </span>
                        <span className="text-[10px] text-slate-400">
                          ({cand.integritySignals.cleanTimePercentage}% clean)
                        </span>
                        <Badge
                          variant={
                            cand.integritySignals.integrityRating === 'HIGH'
                              ? 'success'
                              : cand.integritySignals.integrityRating === 'MODERATE'
                              ? 'warning'
                              : 'destructive'
                          }
                          className="text-[9px]"
                        >
                          {cand.integritySignals.integrityRating}
                        </Badge>
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 6. OPERATIONAL WIDGETS: LIVE JOBS & UPCOMING INTERVIEW CHAMBERS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Job Requisitions */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base text-white">Live Job Requisitions</CardTitle>
              <CardDescription>Open technical requisitions and candidate applicant count</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigateTab('jobs')}
              className="text-xs text-purple-400 hover:text-purple-300"
            >
              Manage All
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {jobs.slice(0, 4).map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 hover:border-purple-500/30 transition-colors"
              >
                <div>
                  <h4 className="font-bold text-white text-xs">{job.title}</h4>
                  <span className="text-[11px] text-slate-400">
                    {job.department} • {job.location}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="role" roleType="RECRUITER">
                    {job._count?.applications || 0} Applicants
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Upcoming Live Panel Interviews */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base text-white">Upcoming Live Panel Chambers</CardTitle>
              <CardDescription>Confirmed interview schedules and candidate rooms</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigateTab('interviews')}
              className="text-xs text-purple-400 hover:text-purple-300"
            >
              View Calendar
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {interviews.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No panel interviews scheduled today.</p>
            ) : (
              interviews.slice(0, 3).map((int) => (
                <div
                  key={int.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 hover:border-purple-500/30 transition-colors"
                >
                  <div className="space-y-0.5">
                    <h4 className="font-bold text-white text-xs">{int.candidate?.name}</h4>
                    <p className="text-[11px] text-slate-400">
                      {int.title} • {formatDate(int.scheduledAt)}
                    </p>
                  </div>
                  <Badge variant="success">{int.durationMins}m Round</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* FULL CANDIDATE COMPARISON MODAL */}
      <CandidateComparisonModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        candidateIds={selectedCandidateIds}
        jobId={filters.jobId !== 'ALL' ? filters.jobId : undefined}
        allJobs={jobs}
      />
    </div>
  );
}
