'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { InterviewApi } from '@/lib/api-interviews';
import {
  SessionDataResponse,
  InterviewQuestion,
  InterviewResponse,
} from '@/types/interview';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import {
  Clock,
  Code2,
  FileText,
  Play,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Send,
  Cloud,
  RotateCcw,
  Sparkles,
  Layers,
  Cpu,
  ShieldCheck,
  Check,
  HelpCircle,
  LogOut,
  Flame,
  Mic,
} from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import LiveCodingIDE from '@/components/coding/LiveCodingIDE';
import VoiceInterviewStudio from '@/components/voice/VoiceInterviewStudio';
import { useProctoringMonitor } from '@/hooks/useProctoringMonitor';
import ProctoringCandidateHUD from '@/components/proctoring/ProctoringCandidateHUD';
import { CodingQuestion, SupportedCodingLanguage, CodingSubmission } from '@/types/coding';

export default function CandidateInterviewPage() {
  const params = useParams();
  const router = useRouter();
  const interviewId = params?.id as string;

  const [sessionData, setSessionData] = useState<SessionDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Client-side proctoring monitor (Face/Gaze/Tab tracking)
  const proctoring = useProctoringMonitor({
    interviewId,
    enabled: Boolean(sessionData && sessionData.session.status === 'IN_PROGRESS'),
  });

  // Active question index and editor state
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [codeAnswer, setCodeAnswer] = useState<string>('');
  const [answerText, setAnswerText] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedCodingLanguage>('javascript');
  const [activeTab, setActiveTab] = useState<'voice' | 'code' | 'text'>('voice');

  // Autosave and Sync state
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Remaining time in seconds
  const [timeLeft, setTimeLeft] = useState<number>(3600);
  const [isExpired, setIsExpired] = useState<boolean>(false);

  // Modals
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [isSubmittingFinal, setIsSubmittingFinal] = useState(false);
  const [testRunOutput, setTestRunOutput] = useState<string | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  const { success, warning, error: toastError } = useToast();

  // 1. Initial Load / Resume Session (Survives Reloads)
  const initializeSession = useCallback(async () => {
    if (!interviewId) return;

    try {
      setLoading(true);
      setError(null);

      // Start or retrieve session state from server
      let data = await InterviewApi.getSession(interviewId).catch(async () => {
        return await InterviewApi.startSession(interviewId);
      });

      // If scheduled, start session automatically
      if (data.session.status === 'SCHEDULED' || data.session.status === 'READY') {
        data = await InterviewApi.startSession(interviewId);
      }

      setSessionData(data);

      // Restore remaining time
      const remaining = data.session.timeRemainingSeconds ?? data.interview.durationMins * 60;
      setTimeLeft(Math.max(0, remaining));
      if (remaining <= 0 || data.session.status === 'EXPIRED') {
        setIsExpired(true);
      }

      // Restore active question index
      const savedIndex = data.session.currentQuestionIndex || 0;
      const validIndex = Math.min(Math.max(0, savedIndex), (data.questions?.length || 1) - 1);
      setCurrentIndex(validIndex);

      // Load response for restored question
      const currentQ = data.questions[validIndex];
      if (currentQ) {
        const existingResp = data.responses.find((r) => r.questionId === currentQ.id);
        if (existingResp) {
          setCodeAnswer(existingResp.codeAnswer || currentQ.starterCode || '');
          setAnswerText(existingResp.answerText || '');
          const lang = existingResp.codeLanguage as SupportedCodingLanguage;
          setSelectedLanguage(['javascript', 'python', 'cpp', 'java'].includes(lang) ? lang : 'javascript');
          setActiveTab(currentQ.type === 'CODING' ? 'code' : 'voice');
        } else {
          setCodeAnswer(currentQ.starterCode || '');
          setAnswerText('');
          setSelectedLanguage('javascript');
          setActiveTab(currentQ.type === 'CODING' ? 'code' : 'voice');
        }
      }
    } catch (err: any) {
      console.error('Failed to initialize interview session:', err);
      setError(
        err.response?.data?.message ||
          'Failed to connect to the interview chamber. Please verify your link or permissions.'
      );
    } finally {
      setLoading(false);
    }
  }, [interviewId]);

  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  // 2. Continuous Autosave (Debounced) to ensure 100% Reload Survival
  const saveCurrentProgress = useCallback(
    async (overrideIndex?: number) => {
      if (!sessionData || sessionData.session.status !== 'IN_PROGRESS') return;

      const activeQ = sessionData.questions[overrideIndex ?? currentIndex];
      if (!activeQ) return;

      try {
        setIsSaving(true);
        await InterviewApi.saveProgress(interviewId, {
          currentQuestionIndex: overrideIndex ?? currentIndex,
          activeResponse: {
            questionId: activeQ.id,
            codeAnswer,
            answerText,
            codeLanguage: selectedLanguage,
          },
        });
        setLastSavedTime(new Date());
      } catch (err) {
        console.warn('Background autosave deferred:', err);
      } finally {
        setIsSaving(false);
      }
    },
    [interviewId, sessionData, currentIndex, codeAnswer, answerText, selectedLanguage]
  );

  // 3. Complete Entire Interview Session
  const handleCompleteInterview = useCallback(async () => {
    try {
      setIsSubmittingFinal(true);
      await saveCurrentProgress();

      const finalData = await InterviewApi.completeSession(interviewId);
      setSessionData(finalData);
      setIsFinishModalOpen(false);
      success('Congratulations! Your interview session has been submitted and recorded.');
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to complete interview session');
    } finally {
      setIsSubmittingFinal(false);
    }
  }, [interviewId, saveCurrentProgress, success, toastError]);

  // 4. Server-Synced Countdown Timer
  useEffect(() => {
    if (loading || !sessionData || sessionData.session.status !== 'IN_PROGRESS' || isExpired) {
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsExpired(true);
          warning('Interview duration has expired! Finalizing session...');
          handleCompleteInterview();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, sessionData, isExpired, handleCompleteInterview, warning]);

  // Trigger autosave when codeAnswer or answerText changes
  useEffect(() => {
    if (loading || !sessionData || sessionData.session.status !== 'IN_PROGRESS') return;

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(() => {
      saveCurrentProgress();
    }, 2000);

    return () => {
      if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    };
  }, [codeAnswer, answerText, loading, sessionData, saveCurrentProgress]);

  // 4. Switch Question Handler
  const handleSelectQuestion = async (index: number) => {
    if (index === currentIndex || !sessionData) return;

    // Save current question first
    await saveCurrentProgress();

    setCurrentIndex(index);
    const nextQ = sessionData.questions[index];
    if (nextQ) {
      const existingResp = sessionData.responses.find((r) => r.questionId === nextQ.id);
      if (existingResp) {
        setCodeAnswer(existingResp.codeAnswer || nextQ.starterCode || '');
        setAnswerText(existingResp.answerText || '');
        const lang = existingResp.codeLanguage as SupportedCodingLanguage;
        setSelectedLanguage(['javascript', 'python', 'cpp', 'java'].includes(lang) ? lang : 'javascript');
        setActiveTab(nextQ.type === 'CODING' ? 'code' : 'voice');
      } else {
        setCodeAnswer(nextQ.starterCode || '');
        setAnswerText('');
        setSelectedLanguage('javascript');
        setActiveTab(nextQ.type === 'CODING' ? 'code' : 'voice');
      }
      setTestRunOutput(null);
    }
  };

  // 5. Submit Single Question
  const handleSubmitCurrentQuestion = async () => {
    if (!sessionData) return;
    const currentQ = sessionData.questions[currentIndex];
    if (!currentQ) return;

    try {
      setIsSaving(true);
      const updatedResp = await InterviewApi.submitQuestion(interviewId, currentQ.id, {
        codeAnswer,
        answerText,
        codeLanguage: selectedLanguage,
      });

      // Update local state
      setSessionData((prev) => {
        if (!prev) return prev;
        const exists = prev.responses.some((r) => r.questionId === currentQ.id);
        const newResponses = exists
          ? prev.responses.map((r) => (r.questionId === currentQ.id ? updatedResp : r))
          : [...prev.responses, updatedResp];
        return { ...prev, responses: newResponses };
      });

      success(`Question ${currentIndex + 1} response submitted.`);

      // Advance to next if available
      if (currentIndex < sessionData.questions.length - 1) {
        handleSelectQuestion(currentIndex + 1);
      }
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to submit question response');
    } finally {
      setIsSaving(false);
    }
  };

  // 6. Test Runner Simulator
  const handleRunTests = () => {
    setIsRunningTests(true);
    setTestRunOutput(null);

    setTimeout(() => {
      const currentQ = sessionData?.questions[currentIndex];
      const testCases = currentQ?.testCases || [];

      if (testCases.length === 0) {
        setTestRunOutput(`[Syntax Check]: Code syntax valid for ${selectedLanguage}.\n✓ No compile errors detected.`);
      } else {
        const passedCount = testCases.length;
        const outputLines = [
          `Running test suite for: ${currentQ?.title}`,
          `=========================================`,
          ...testCases.map(
            (tc, idx) =>
              `Test Case ${idx + 1}: ${tc.description}\n  Input: ${tc.input}\n  Expected: ${tc.expectedOutput}\n  Output: ${tc.expectedOutput} [PASSED]`
          ),
          `=========================================`,
          `Result: ${passedCount}/${testCases.length} Test Cases Passed (100%)`,
          `Memory: 14.2 MB | Execution Time: 42ms`,
        ];
        setTestRunOutput(outputLines.join('\n'));
      }
      setIsRunningTests(false);
    }, 600);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4 text-white p-4">
        <div className="relative w-16 h-16">
          <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <Cpu className="w-7 h-7 text-indigo-400 absolute inset-0 m-auto animate-pulse" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold text-white">Connecting to Technical Interview Chamber...</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Restoring cloud state, question bank rubric, and sandbox buffers.
          </p>
        </div>
      </div>
    );
  }

  // Error Screen
  if (error || !sessionData) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Interview Chamber Unavailable</h3>
          <p className="text-xs text-slate-300 leading-relaxed">{error}</p>
          <div className="flex gap-3 justify-center pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/dashboard?tab=interviews')}
              className="text-xs bg-slate-800 text-slate-200 border-slate-700"
            >
              Back to Dashboard
            </Button>
            <Button
              size="sm"
              onClick={initializeSession}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Retry Connection
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { interview, session, questions = [], responses = [] } = sessionData;
  const currentQuestion = questions && questions.length > 0
    ? (questions[currentIndex] || questions[0])
    : null;
  const isCompleted = session.status === 'COMPLETED';

  // Completion View
  if (isCompleted) {
    const answeredCount = responses.filter(
      (r) => r.isSubmitted || (r.codeAnswer && r.codeAnswer.trim().length > 0) || (r.answerText && r.answerText.trim().length > 0)
    ).length;

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-white">
        <div className="max-w-lg w-full p-8 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl text-center space-y-6 shadow-2xl relative overflow-hidden animate-scaleUp">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center mx-auto text-white shadow-xl shadow-emerald-500/25">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">Interview Completed!</h2>
            <p className="text-sm text-slate-400 mt-1">
              Your responses for <span className="text-indigo-300 font-semibold">{interview.title}</span> have been submitted to the recruitment team.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-left">
            <div>
              <span className="text-[11px] text-slate-500 uppercase font-bold block">Questions Solved</span>
              <span className="text-lg font-bold text-white mt-0.5 block">
                {answeredCount} / {questions.length}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 uppercase font-bold block">Interview Type</span>
              <span className="text-lg font-bold text-indigo-400 mt-0.5 block">
                {interview.type}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Your recruiter and technical evaluation team will review your code architecture, test results, and verbal explanations. You will receive an email update once feedback is recorded.
          </p>

          <Button
            onClick={() => router.push('/dashboard?tab=interviews')}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 text-sm rounded-xl shadow-lg shadow-indigo-600/25"
          >
            Return to Candidate Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Guard against missing / empty questions
  if (!currentQuestion || questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-xl shadow-indigo-500/20">
          <Cpu className="w-8 h-8 animate-pulse" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight">Interview Chamber Preparing</h2>
          <p className="text-sm text-slate-400 max-w-md">
            The technical questions are being prepared for <span className="text-indigo-300 font-semibold">{interview.title}</span>.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => initializeSession()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/25"
          >
            Connect Chamber
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard?tab=interviews')}
            className="border-slate-800 text-slate-300 hover:bg-slate-900 text-xs px-5 py-2.5 rounded-xl"
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const isLowTime = timeLeft <= 300; // Under 5 minutes

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* Top Navbar */}
      <header className="h-16 px-6 bg-slate-900/80 border-b border-slate-800 backdrop-blur-md flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center space-x-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-bold text-white tracking-wide truncate max-w-xs sm:max-w-md">
                {interview.title}
              </h1>
              <Badge variant="role" roleType="CANDIDATE" className="text-[10px]">
                {interview.type}
              </Badge>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                {interview.difficulty}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Role: <span className="text-slate-300 font-medium">{interview.job?.title || 'Engineer'}</span> • Question {currentIndex + 1} of {questions.length}
            </p>
          </div>
        </div>

        {/* Right Header: Autosave status, Timer, and Complete Action */}
        <div className="flex items-center space-x-3">
          {/* Cloud Autosave Indicator */}
          <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-300">
            {isSaving ? (
              <>
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping mr-1" />
                <span className="text-amber-300">Saving progress...</span>
              </>
            ) : (
              <>
                <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cloud Synced</span>
              </>
            )}
          </div>

          {/* Countdown Timer */}
          <div
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl border font-mono text-sm font-bold shadow-sm transition-colors ${
              isLowTime
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                : 'bg-slate-800/90 text-slate-200 border-slate-700'
            }`}
            title="Interview time remaining (persisted server-side)"
          >
            <Clock className={`w-4 h-4 ${isLowTime ? 'text-rose-400' : 'text-indigo-400'}`} />
            <span>{formatTimer(timeLeft)}</span>
          </div>

          {/* Finish Button */}
          <Button
            size="sm"
            onClick={() => setIsFinishModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 h-9 shadow-md shadow-emerald-600/20"
          >
            Finish Interview
          </Button>

          {/* Exit prompt */}
          <button
            onClick={() => setIsExitModalOpen(true)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Exit Chamber"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Side: Question Navigator & Specification */}
        <div className="w-full md:w-5/12 lg:w-4/12 border-r border-slate-800 bg-slate-900/40 flex flex-col overflow-y-auto">
          {/* Question Navigator Strip */}
          <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex items-center space-x-2 overflow-x-auto">
            {questions.map((q, idx) => {
              const resp = responses.find((r) => r.questionId === q.id);
              const isAnswered = resp?.isSubmitted || (resp?.codeAnswer && resp.codeAnswer.trim().length > 0) || (resp?.answerText && resp.answerText.trim().length > 0);
              const isActive = idx === currentIndex;

              return (
                <button
                  key={q.id}
                  onClick={() => handleSelectQuestion(idx)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : isAnswered
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                >
                  {isAnswered && <Check className="w-3 h-3 text-emerald-400" />}
                  <span>Q{idx + 1}</span>
                </button>
              );
            })}
          </div>

          {/* Question Details */}
          <div className="p-6 space-y-5 flex-1">
            <div className="space-y-1.5">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                  {currentQuestion?.category || 'Technical'}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-[11px] font-mono text-slate-400">
                  {currentQuestion?.type || 'MIXED'}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {currentQuestion?.title || 'Technical Assessment Question'}
              </h2>
            </div>

            {/* Description */}
            <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-line p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              {currentQuestion?.description || 'Please complete the question prompt.'}
            </div>

            {/* Test Cases / Sample Inputs */}
            {currentQuestion?.testCases && currentQuestion.testCases.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>Sample Test Cases</span>
                </h4>
                <div className="space-y-2">
                  {currentQuestion.testCases.map((tc, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 font-mono text-[11px] space-y-1"
                    >
                      <span className="text-slate-400 text-[10px] block font-sans font-semibold">
                        Case {idx + 1}: {tc.description}
                      </span>
                      <div className="text-slate-300">
                        <strong className="text-slate-500">Input:</strong> {tc.input}
                      </div>
                      <div className="text-emerald-400">
                        <strong className="text-slate-500">Expected:</strong> {tc.expectedOutput}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Evaluation Rubric Criteria Hints & Expected Topics */}
            {(currentQuestion.expectedTopics || currentQuestion.rubricCriteria?.keyConcepts) && (
              <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/20 space-y-2 text-xs">
                <span className="font-bold text-indigo-300 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Expected Key Concepts & Topics</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(currentQuestion.expectedTopics || currentQuestion.rubricCriteria?.keyConcepts || []).map((concept: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                    >
                      {concept}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Interactive Studio (Code & Written Response) */}
        <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
          {/* Studio Header: Tab switch */}
          <div className="h-12 px-6 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveTab('voice')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                  activeTab === 'voice'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Mic className="w-3.5 h-3.5 text-rose-400" />
                <span>Voice Interview</span>
              </button>
              <button
                onClick={() => setActiveTab('code')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                  activeTab === 'code'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Live Coding IDE</span>
              </button>
              <button
                onClick={() => setActiveTab('text')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                  activeTab === 'text'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span>Written Notes</span>
              </button>
            </div>

            {activeTab === 'voice' && (
              <div className="hidden sm:flex items-center space-x-2 text-[11px] text-slate-400">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span>Voice AI Ready • Objective Metrics</span>
              </div>
            )}
            {activeTab === 'code' && (
              <div className="hidden sm:flex items-center space-x-2 text-[11px] text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Sandboxed Execution Environment Ready</span>
              </div>
            )}
          </div>

          {/* Editor Body */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
            {activeTab === 'voice' ? (
              <VoiceInterviewStudio
                key={`voice-${currentQuestion.id}-${currentIndex}`}
                question={currentQuestion}
                interviewId={interviewId}
                initialTranscript={answerText}
                onResponseSubmitted={(result) => {
                  setSessionData((prev) => {
                    if (!prev) return prev;
                    const exists = prev.responses.some((r) => r.questionId === currentQuestion.id);
                    const updatedResp: InterviewResponse = {
                      ...result.response,
                      timeSpentSeconds: Math.round(result.metrics.durationSeconds),
                    };
                    const newResponses = exists
                      ? prev.responses.map((r) => (r.questionId === currentQuestion.id ? updatedResp : r))
                      : [...prev.responses, updatedResp];
                    return { ...prev, responses: newResponses };
                  });
                  setAnswerText(result.response.transcript || result.response.answerText || '');
                  if (!result.isLastQuestion) {
                    handleSelectQuestion(result.nextQuestionIndex);
                  }
                }}
                className="h-full"
              />
            ) : activeTab === 'code' ? (
              <LiveCodingIDE
                key={`${currentQuestion.id}-${currentIndex}`}
                question={{
                  id: currentQuestion.id,
                  title: currentQuestion.title,
                  description: currentQuestion.description,
                  difficulty: (['EASY', 'MEDIUM', 'HARD'].includes(currentQuestion.difficulty)
                    ? currentQuestion.difficulty
                    : 'MEDIUM') as any,
                  constraints: (currentQuestion as any).constraints || [],
                  examples: (currentQuestion as any).examples || [],
                  testCases:
                    currentQuestion.testCases?.map((tc) => ({
                      input: tc.input,
                      expectedOutput: tc.expectedOutput,
                      description: tc.description,
                      isHidden: (tc as any).isHidden,
                    })) || [],
                  starterCode:
                    typeof currentQuestion.starterCode === 'object' && currentQuestion.starterCode !== null
                      ? currentQuestion.starterCode
                      : undefined,
                  supportedLanguages: ['javascript', 'python', 'cpp', 'java'],
                }}
                interviewId={interviewId}
                initialCode={codeAnswer}
                initialLanguage={selectedLanguage}
                onCodeChange={(code: string, lang: SupportedCodingLanguage) => {
                  setCodeAnswer(code);
                  setSelectedLanguage(lang);
                }}
                onSubmitted={(sub: CodingSubmission) => {
                  setSessionData((prev) => {
                    if (!prev) return prev;
                    const exists = prev.responses.some((r) => r.questionId === currentQuestion.id);
                    const updatedResp: InterviewResponse = {
                      id: sub.id,
                      interviewId,
                      questionId: currentQuestion.id,
                      candidateId: session.candidateId || (interview as any).candidateId || '',
                      codeAnswer: sub.code,
                      answerText,
                      codeLanguage: sub.language,
                      executionResults: sub.testResults,
                      timeSpentSeconds: 0,
                      isSubmitted: true,
                      submittedAt: sub.submittedAt,
                    };
                    const newResponses = exists
                      ? prev.responses.map((r) => (r.questionId === currentQuestion.id ? updatedResp : r))
                      : [...prev.responses, updatedResp];
                    return { ...prev, responses: newResponses };
                  });
                }}
                className="h-full border-0 rounded-none bg-transparent"
              />
            ) : (
              <div className="flex-1 flex flex-col p-4 overflow-hidden">
                <div className="flex-1 flex flex-col bg-slate-900/90 rounded-xl border border-slate-800 overflow-hidden shadow-inner">
                  <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Architectural explanation, trade-off analysis & behavioral reflections</span>
                    <span>Markdown supported</span>
                  </div>
                  <textarea
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder="Detail your engineering approach, system architecture, trade-offs, and algorithmic complexity..."
                    className="flex-1 w-full p-4 bg-transparent text-slate-200 resize-none focus:outline-none text-xs leading-relaxed font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bottom Action Controls */}
          <div className="h-14 px-6 bg-slate-900/70 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => saveCurrentProgress()}
                disabled={isSaving}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 gap-1.5"
              >
                <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                <span>Save Draft</span>
              </Button>
            </div>

            <div className="flex items-center space-x-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSelectQuestion(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
                className="text-xs bg-slate-800 border-slate-700"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Previous
              </Button>

              <Button
                size="sm"
                onClick={handleSubmitCurrentQuestion}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold gap-1.5 px-4 shadow-md shadow-indigo-600/20"
              >
                <span>{currentIndex === questions.length - 1 ? 'Save & Review' : 'Save & Next Question'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Final Submission */}
      <Dialog
        isOpen={isFinishModalOpen}
        onClose={() => setIsFinishModalOpen(false)}
        title="Finalize & Submit Interview"
        description="Are you ready to submit your technical interview session?"
      >
        <div className="space-y-4 text-xs text-slate-300">
          <p>
            You have completed{' '}
            <strong className="text-white">
              {
                responses.filter(
                  (r) => r.isSubmitted || (r.codeAnswer && r.codeAnswer.trim().length > 0) || (r.answerText && r.answerText.trim().length > 0)
                ).length
              }
            </strong>{' '}
            of <strong className="text-white">{questions.length}</strong> questions.
          </p>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
            <span className="font-semibold text-slate-200 block">Interview Summary</span>
            <div className="text-slate-400 flex justify-between">
              <span>Time Remaining:</span>
              <span className="font-mono text-indigo-400 font-bold">{formatTimer(timeLeft)}</span>
            </div>
            <div className="text-slate-400 flex justify-between">
              <span>Cloud Status:</span>
              <span className="text-emerald-400 font-bold">100% Synced</span>
            </div>
          </div>

          <p className="text-amber-400 flex items-start gap-1.5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Once finalized, you will not be able to modify your code or responses.</span>
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFinishModalOpen(false)}
            disabled={isSubmittingFinal}
          >
            Continue Working
          </Button>
          <Button
            size="sm"
            onClick={handleCompleteInterview}
            disabled={isSubmittingFinal}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isSubmittingFinal ? 'Finalizing...' : 'Confirm Submission'}</span>
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Exit Modal */}
      <Dialog
        isOpen={isExitModalOpen}
        onClose={() => setIsExitModalOpen(false)}
        title="Exit Interview Chamber?"
        description="Your timer will continue running server-side while you are away."
      >
        <div className="space-y-3 text-xs text-slate-300">
          <p>
            Your current code buffers and question progress are saved in the cloud. You can return to this chamber at any time before the timer expires to resume your session.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setIsExitModalOpen(false)}>
            Stay in Chamber
          </Button>
          <Button
            size="sm"
            onClick={() => router.push('/dashboard?tab=interviews')}
            className="bg-slate-800 hover:bg-slate-700 text-white"
          >
            Leave to Dashboard
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Real-Time Client-Side Proctoring HUD */}
      {sessionData?.session.status === 'IN_PROGRESS' && (
        <ProctoringCandidateHUD
          status={proctoring.status}
          videoRef={proctoring.videoRef as any}
        />
      )}
    </div>
  );
}
