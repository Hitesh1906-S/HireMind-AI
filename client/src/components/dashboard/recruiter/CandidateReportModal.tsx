'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Printer,
  X,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Code2,
  Mic,
  Brain,
  User,
  Briefcase,
  Layers,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { reportsApi, CandidateReportData } from '@/lib/api-reports';

interface CandidateReportModalProps {
  interviewId?: string | null;
  applicationId?: string | null;
  candidateName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CandidateReportModal({
  interviewId,
  applicationId,
  candidateName,
  isOpen,
  onClose,
}: CandidateReportModalProps) {
  const [report, setReport] = useState<CandidateReportData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || (!interviewId && !applicationId)) return;

    let isMounted = true;
    const fetchReport = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let data: CandidateReportData;
        if (interviewId) {
          data = await reportsApi.getInterviewReport(interviewId);
        } else if (applicationId) {
          data = await reportsApi.getApplicationReport(applicationId);
        } else {
          throw new Error('No interview or application ID provided');
        }

        if (isMounted) {
          setReport(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(
            err.response?.data?.message ||
              err.message ||
              'Failed to generate interview report. Please try again.'
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchReport();

    return () => {
      isMounted = false;
    };
  }, [isOpen, interviewId, applicationId]);

  if (!isOpen) return null;

  const handleDownloadPdf = async () => {
    if (!report) return;
    setIsDownloading(true);
    try {
      if (interviewId) {
        await reportsApi.downloadInterviewReportPdf(interviewId, report.candidate.name);
      } else if (applicationId) {
        await reportsApi.downloadApplicationReportPdf(applicationId, report.candidate.name);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to download PDF report.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getRecommendationBadgeVariant = (rec: string) => {
    switch (rec) {
      case 'STRONG_HIRE':
        return 'success';
      case 'HIRE':
        return 'role';
      case 'MAYBE':
        return 'warning';
      case 'NO_HIRE':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/60 sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Candidate Evaluation Dossier
                </h2>
                {report && (
                  <Badge variant="outline" className="text-[10px] font-mono border-slate-700 text-slate-300">
                    {report.reportId}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {candidateName ? `${candidateName} • ` : ''}Verified hiring intelligence with 15 evaluation dimensions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={isLoading || !report}
              className="text-xs border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800 gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={isLoading || !report || isDownloading}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold gap-1.5 shadow-lg shadow-indigo-600/20"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  Download PDF Report
                </>
              )}
            </Button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body Container */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 text-slate-200 print:overflow-visible">
          {isLoading && (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              <p className="text-sm font-medium">Assembling 15-section candidate intelligence report...</p>
              <p className="text-xs text-slate-500">Synthesizing coding tests, voice cadence, proctoring signals, and AI evaluation.</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="p-6 rounded-xl bg-rose-950/30 border border-rose-800/50 text-rose-300 flex flex-col items-center justify-center gap-3 text-center">
              <AlertCircle className="w-8 h-8 text-rose-400" />
              <h3 className="text-sm font-bold">Failed to load report</h3>
              <p className="text-xs text-rose-400/90 max-w-md">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
                className="mt-2 text-xs border-rose-800 text-rose-300 hover:bg-rose-950 gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </Button>
            </div>
          )}

          {report && !isLoading && (
            <>
              {/* CLASSIFICATION LEGEND NOTICE */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="text-slate-400 text-[11px] font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-slate-300" />
                  <span>Report Source Classification System:</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-950/70 border border-indigo-500/40 text-indigo-300">
                    <Sparkles className="w-3 h-3 text-indigo-400" />
                    AI-GENERATED EVALUATION
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950/70 border border-emerald-500/40 text-emerald-300">
                    <Code2 className="w-3 h-3 text-emerald-400" />
                    OBJECTIVE TEST RESULTS
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-950/70 border border-amber-500/40 text-amber-300">
                    <User className="w-3 h-3 text-amber-400" />
                    RECRUITER-ENTERED NOTES
                  </span>
                </div>
              </div>

              {/* EXECUTIVE BANNER CARD */}
              <Card className="border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/90 to-indigo-950/40 p-6 rounded-2xl relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-black text-white">{report.candidate.name}</h1>
                      <Badge variant={getRecommendationBadgeVariant(report.aiRecommendation.recommendation)}>
                        {report.aiRecommendation.recommendation.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-300 font-medium">{report.job.title} • {report.job.department}</p>
                    <p className="text-xs text-slate-400">
                      Evaluated on {new Date(report.generatedAt).toLocaleDateString()} • Candidate ID: {report.candidate.id.slice(0, 8)}
                    </p>
                  </div>

                  {/* Overall Score Box */}
                  <div className="flex items-center gap-4 bg-slate-950/60 border border-slate-800 px-5 py-3 rounded-xl self-start sm:self-auto">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Deterministic Overall</p>
                      <p className="text-xs text-emerald-400 font-medium">Weighted Composite</p>
                    </div>
                    <div className="text-3xl font-black text-white">
                      {report.overallScore.finalScore}
                      <span className="text-xs text-slate-400 font-normal">/100</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* 1. CANDIDATE INFORMATION & 2. JOB INFORMATION */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* SECTION 1: CANDIDATE INFORMATION */}
                <Card className="border-slate-800 bg-slate-900/40 p-5 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-white">1. Candidate Information</h3>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 px-2 py-0.5 rounded bg-slate-800/60 border border-slate-700/50">
                      PROFILE DATA
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Email</p>
                      <p className="text-slate-200 font-medium truncate">{report.candidate.email}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Phone</p>
                      <p className="text-slate-200 font-medium">{report.candidate.phone}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Location</p>
                      <p className="text-slate-200 font-medium">{report.candidate.location}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Experience</p>
                      <p className="text-slate-200 font-medium">{report.candidate.yearsOfExperience} Years</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Education</p>
                      <p className="text-slate-200 font-medium">{report.candidate.education}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Declared Skills</p>
                      <div className="flex flex-wrap gap-1">
                        {report.candidate.skills.slice(0, 6).map((skill, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>

                {/* SECTION 2: JOB INFORMATION */}
                <Card className="border-slate-800 bg-slate-900/40 p-5 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-slate-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-white">2. Job Requisition Information</h3>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 px-2 py-0.5 rounded bg-slate-800/60 border border-slate-700/50">
                      REQUISITION DATA
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Position Title</p>
                      <p className="text-slate-200 font-medium">{report.job.title}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Department</p>
                      <p className="text-slate-200 font-medium">{report.job.department}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Level & Type</p>
                      <p className="text-slate-200 font-medium">{report.job.experienceLevel} ({report.job.employmentType})</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Assigned Recruiter</p>
                      <p className="text-slate-200 font-medium">{report.job.recruiterName}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Required Skills</p>
                      <div className="flex flex-wrap gap-1">
                        {report.job.requiredSkills.map((skill, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded text-[10px] bg-indigo-950/60 text-indigo-300 border border-indigo-700/50">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* 3. RESUME SUMMARY & 4. RESUME MATCH */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* SECTION 3: RESUME SUMMARY */}
                <Card className="border-slate-800 bg-slate-900/40 p-5 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">3. Resume Summary</h3>
                    <span className="text-[10px] font-bold text-indigo-400 px-2 py-0.5 rounded-full bg-indigo-950/70 border border-indigo-500/40 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      AI-GENERATED EVALUATION
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{report.resumeSummary.executiveSummary}</p>
                  <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800 text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-300">Highlight: </span>
                    {report.resumeSummary.primaryRoleHighlights}
                  </div>
                </Card>

                {/* SECTION 4: RESUME MATCH */}
                <Card className="border-slate-800 bg-slate-900/40 p-5 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">4. Resume Match</h3>
                    <span className="text-[10px] font-bold text-indigo-400 px-2 py-0.5 rounded-full bg-indigo-950/70 border border-indigo-500/40 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      AI-GENERATED EVALUATION
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/40 border border-slate-800">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Match Score</p>
                      <p className="text-xl font-bold text-white">{report.resumeMatch.matchScore}%</p>
                    </div>
                    <Badge variant="role">{report.resumeMatch.rating.replace('_', ' ')}</Badge>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <p className="text-[10px] font-semibold text-emerald-400 uppercase mb-1">Matched Skills</p>
                      <div className="flex flex-wrap gap-1">
                        {report.resumeMatch.matchedSkills.map((skill, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded text-[10px] bg-emerald-950/40 text-emerald-300 border border-emerald-800/50">
                            ✓ {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                    {report.resumeMatch.missingSkills.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-amber-400 uppercase mb-1">Missing / Gap Skills</p>
                        <div className="flex flex-wrap gap-1">
                          {report.resumeMatch.missingSkills.map((skill, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded text-[10px] bg-amber-950/40 text-amber-300 border border-amber-800/50">
                              ! {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              {/* 5. CODING PERFORMANCE (OBJECTIVE) */}
              <Card className="border-slate-800 bg-slate-900/40 p-5 rounded-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">5. Coding Performance</h3>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/40 flex items-center gap-1">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    OBJECTIVE TEST RESULTS
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Pass Rate</p>
                    <p className="text-lg font-bold text-emerald-400">{report.codingPerformance.passRate}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Coding Score</p>
                    <p className="text-lg font-bold text-white">{report.codingPerformance.score}/100</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Execution Time</p>
                    <p className="text-lg font-bold text-white">{report.codingPerformance.executionTimeMs} ms</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Language & Status</p>
                    <p className="text-sm font-bold text-indigo-300 mt-1">{report.codingPerformance.primaryLanguage} ({report.codingPerformance.status})</p>
                  </div>
                </div>

                {report.codingPerformance.submissions.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950/80 text-[10px] uppercase font-semibold text-slate-400">
                        <tr>
                          <th className="p-2.5">Problem Statement</th>
                          <th className="p-2.5">Difficulty</th>
                          <th className="p-2.5">Language</th>
                          <th className="p-2.5">Passed Tests</th>
                          <th className="p-2.5">Execution</th>
                          <th className="p-2.5">Outcome</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                        {report.codingPerformance.submissions.map((sub, i) => (
                          <tr key={i} className="hover:bg-slate-800/30">
                            <td className="p-2.5 font-medium text-slate-200">{sub.problemTitle}</td>
                            <td className="p-2.5 text-slate-400">{sub.difficulty}</td>
                            <td className="p-2.5 text-indigo-300 font-mono text-[11px]">{sub.language}</td>
                            <td className="p-2.5 text-emerald-400 font-semibold">{sub.passedTests} / {sub.totalTests}</td>
                            <td className="p-2.5 text-slate-400">{sub.executionTimeMs} ms</td>
                            <td className="p-2.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                                {sub.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              {/* 6. TECHNICAL INTERVIEW & 7. COMMUNICATION */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* SECTION 6: TECHNICAL INTERVIEW */}
                <Card className="border-slate-800 bg-slate-900/40 p-5 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-indigo-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-white">6. Technical Interview</h3>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-400 px-2 py-0.5 rounded-full bg-indigo-950/70 border border-indigo-500/40 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      AI-GENERATED EVALUATION
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/40 border border-slate-800">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Technical Score</p>
                      <p className="text-xl font-bold text-white">{report.technicalInterview.score}/100</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Problem Solving</p>
                      <p className="text-sm font-bold text-indigo-400">{report.technicalInterview.problemSolvingScore}/100</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{report.technicalInterview.summary}</p>
                </Card>

                {/* SECTION 7: COMMUNICATION */}
                <Card className="border-slate-800 bg-slate-900/40 p-5 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Mic className="w-4 h-4 text-indigo-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-white">7. Communication</h3>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-400 px-2 py-0.5 rounded-full bg-indigo-950/70 border border-indigo-500/40 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      AI-GENERATED EVALUATION
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800 text-center">
                      <p className="text-[9px] text-slate-400 uppercase font-semibold">Score</p>
                      <p className="text-base font-bold text-white">{report.communication.score}/100</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800 text-center">
                      <p className="text-[9px] text-slate-400 uppercase font-semibold">Cadence</p>
                      <p className="text-base font-bold text-indigo-400">{report.communication.speakingWpm} <span className="text-[9px] text-slate-400">WPM</span></p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800 text-center">
                      <p className="text-[9px] text-slate-400 uppercase font-semibold">Filler Words</p>
                      <p className="text-base font-bold text-amber-400">{report.communication.fillerWordCount}</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{report.communication.summary}</p>
                </Card>
              </div>

              {/* 8. INTERVIEW TRANSCRIPT SUMMARY */}
              <Card className="border-slate-800 bg-slate-900/40 p-5 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">8. Interview Transcript Summary</h3>
                  <span className="text-[10px] font-bold text-indigo-400 px-2 py-0.5 rounded-full bg-indigo-950/70 border border-indigo-500/40 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    AI-GENERATED EVALUATION
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{report.transcriptSummary.synopsis}</p>

                <div className="space-y-2 mt-2">
                  {report.transcriptSummary.keyQuestions.map((q, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-950/50 border border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold text-white">
                        <span>Q{q.orderIndex}: {q.question}</span>
                        <Badge variant="outline" className="text-[9px] font-mono border-slate-700 text-slate-400">
                          {q.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 italic">&ldquo;{q.answerExcerpt}&rdquo;</p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* 9. INTEGRITY SIGNALS (OBJECTIVE) */}
              <Card className="border-slate-800 bg-slate-900/40 p-5 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">9. Integrity Signals</h3>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/40 flex items-center gap-1">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    OBJECTIVE TEST RESULTS
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Integrity Rating</p>
                    <p className="text-base font-bold text-emerald-400">{report.integritySignals.rating}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Clean Session Time</p>
                    <p className="text-base font-bold text-white">{report.integritySignals.cleanTimePercentage}%</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Tab Blur Events</p>
                    <p className="text-base font-bold text-slate-300">{report.integritySignals.tabHiddenEvents}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Face Disconnects</p>
                    <p className="text-base font-bold text-slate-300">{report.integritySignals.multipleFacesEvents}</p>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 italic mt-1">{report.integritySignals.disclaimer}</p>
              </Card>

              {/* 10. STRENGTHS, 11. WEAKNESSES, 12. RECOMMENDED IMPROVEMENTS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 10. STRENGTHS */}
                <Card className="border-slate-800 bg-slate-900/40 p-5 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">10. Strengths</h3>
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {report.strengths.map((str, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </Card>

                {/* 11. WEAKNESSES */}
                <Card className="border-slate-800 bg-slate-900/40 p-5 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400">11. Weaknesses</h3>
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {report.weaknesses.map((w, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </Card>

                {/* 12. RECOMMENDED IMPROVEMENTS */}
                <Card className="border-slate-800 bg-slate-900/40 p-5 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">12. Recommended Improvements</h3>
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {report.recommendedImprovements.map((imp, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                        <span>{imp}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>

              {/* 13. OVERALL SCORE BREAKDOWN (OBJECTIVE) */}
              <Card className="border-slate-800 bg-slate-900/40 p-5 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">13. Overall Score Breakdown</h3>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/40 flex items-center gap-1">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    OBJECTIVE FORMULA (NO AI ARITHMETIC)
                  </span>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/80 text-[10px] uppercase font-semibold text-slate-400">
                      <tr>
                        <th className="p-2.5">Evaluation Dimension</th>
                        <th className="p-2.5 text-right">Raw Score (0-100)</th>
                        <th className="p-2.5 text-right">Weight (%)</th>
                        <th className="p-2.5 text-right">Weighted Contribution</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                      {report.overallScore.breakdown.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/20">
                          <td className="p-2.5 font-medium text-slate-200">{row.dimension}</td>
                          <td className="p-2.5 text-right text-slate-300">{row.rawScore} / 100</td>
                          <td className="p-2.5 text-right text-indigo-400 font-semibold">{row.weightPercentage}%</td>
                          <td className="p-2.5 text-right text-emerald-400 font-bold">+{row.weightedPoints} pts</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-950 font-bold">
                        <td className="p-2.5 text-white">FINAL DETERMINISTIC OVERALL SCORE</td>
                        <td className="p-2.5 text-right text-slate-400">-</td>
                        <td className="p-2.5 text-right text-indigo-400">100%</td>
                        <td className="p-2.5 text-right text-white text-sm">{report.overallScore.finalScore} / 100</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* 14. AI RECOMMENDATION & 15. RECRUITER NOTES */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* SECTION 14: AI RECOMMENDATION */}
                <Card className="border-slate-800 bg-slate-900/40 p-5 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">14. AI Recommendation</h3>
                    <span className="text-[10px] font-bold text-indigo-400 px-2 py-0.5 rounded-full bg-indigo-950/70 border border-indigo-500/40 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      AI-GENERATED EVALUATION
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge variant={getRecommendationBadgeVariant(report.aiRecommendation.recommendation)}>
                      {report.aiRecommendation.recommendation.replace('_', ' ')}
                    </Badge>
                    <span className="text-xs text-slate-400">Synthesized hiring decision support</span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{report.aiRecommendation.summary}</p>
                  <p className="text-[10px] text-slate-500 italic border-t border-slate-800/60 pt-2">
                    {report.aiRecommendation.disclaimer}
                  </p>
                </Card>

                {/* SECTION 15: RECRUITER NOTES */}
                <Card className="border-amber-800/50 bg-amber-950/10 p-5 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-amber-800/40 pb-2.5">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-amber-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">15. Recruiter Notes & Decisions</h3>
                    </div>
                    <span className="text-[10px] font-bold text-amber-400 px-2 py-0.5 rounded-full bg-amber-950/70 border border-amber-500/40 flex items-center gap-1">
                      <User className="w-2.5 h-2.5" />
                      RECRUITER-ENTERED NOTES
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-semibold">Reviewer:</span>
                      <span className="text-slate-200 font-medium">{report.recruiterNotes.recruiterName || 'Hiring Panel'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-semibold">Manual Override:</span>
                      <span className="text-slate-200 font-medium">
                        {report.recruiterNotes.isOverridden
                          ? `Yes (${report.recruiterNotes.recruiterRecommendation})`
                          : 'None (Default alignment)'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-semibold">Application Status:</span>
                      <Badge variant="outline" className="border-amber-700/60 text-amber-300 text-[10px]">
                        {report.recruiterNotes.applicationStatus}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950/60 border border-amber-800/30 text-xs text-slate-300 leading-relaxed">
                    <p className="font-semibold text-amber-300 text-[11px] mb-1">Recruiter Observations:</p>
                    {report.recruiterNotes.recruiterNotes ||
                      'Candidate was evaluated during standard recruitment cycle. Ready for panel review and debrief discussion.'}
                  </div>
                </Card>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800/80 bg-slate-900/60 sticky bottom-0 z-20 backdrop-blur-md">
          <p className="text-[11px] text-slate-500 hidden sm:block">
            HireMind AI Intelligence Engine • Professional PDF Generation Enabled
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs border-slate-700 text-slate-300">
              Close
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={isLoading || !report || isDownloading}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF Report
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
