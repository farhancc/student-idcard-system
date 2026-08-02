'use client';

import React from 'react';
import { Cpu, FileText, CheckCircle2, Zap, Layers, Sparkles } from 'lucide-react';

interface PdfCompileLoadingAnimationProps {
  progress?: number;
  message?: string;
  subMessage?: string;
  compact?: boolean;
}

export default function PdfCompileLoadingAnimation({
  progress = 45,
  message = 'Compiling PDF Document…',
  subMessage = 'Generating high-resolution print vectors & layout grid',
  compact = false,
}: PdfCompileLoadingAnimationProps) {
  // Determine current lifecycle phase based on progress percentage
  const getPhase = (p: number) => {
    if (p < 25) return { stage: 1, text: 'Fetching template assets & cardholder photos…' };
    if (p < 55) return { stage: 2, text: 'Rendering vector graphics & custom date fields…' };
    if (p < 85) return { stage: 3, text: 'Embedding print grid layout & crop marks…' };
    return { stage: 4, text: 'Finalizing PDF document & writing buffer…' };
  };

  const currentPhase = getPhase(progress);

  if (compact) {
    return (
      <div className="pdf-compile-compact-root">
        <div className="scanner-ring-compact">
          <div className="inner-ring" />
          <Zap size={14} className="zap-icon" />
        </div>
        <div className="compact-text-wrap">
          <span className="compact-msg">{message}</span>
          <div className="compact-progress-track">
            <div className="compact-progress-bar" style={{ width: `${Math.min(100, Math.max(5, progress))}%` }} />
          </div>
        </div>
        <span className="compact-percent">{Math.round(progress)}%</span>

        <style jsx>{`
          .pdf-compile-compact-root {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 12px;
            background: rgba(15, 23, 42, 0.85);
            border: 1px solid rgba(99, 102, 241, 0.35);
            border-radius: 8px;
            backdrop-filter: blur(8px);
          }
          .scanner-ring-compact {
            position: relative;
            width: 26px;
            height: 26px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .inner-ring {
            position: absolute;
            inset: 0;
            border: 2px solid transparent;
            border-top-color: #6366f1;
            border-right-color: #a855f7;
            border-radius: 50%;
            animation: spinRing 1s linear infinite;
          }
          :global(.zap-icon) {
            color: #fbbf24;
            animation: pulseGlow 1.2s ease-in-out infinite;
          }
          .compact-text-wrap {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 4px;
            min-width: 0;
          }
          .compact-msg {
            font-size: 0.75rem;
            font-weight: 600;
            color: #f8fafc;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .compact-progress-track {
            height: 4px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 2px;
            overflow: hidden;
          }
          .compact-progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #6366f1, #a855f7, #ec4899, #6366f1);
            background-size: 200% 100%;
            animation: gradientShimmer 2s linear infinite;
            transition: width 0.3s ease;
          }
          .compact-percent {
            font-size: 0.72rem;
            font-weight: 700;
            color: #a855f7;
            font-family: monospace;
          }
          @keyframes spinRing {
            to { transform: rotate(360deg); }
          }
          @keyframes pulseGlow {
            0%, 100% { opacity: 0.6; transform: scale(0.95); }
            50% { opacity: 1; transform: scale(1.1); }
          }
          @keyframes gradientShimmer {
            0% { background-position: 0% 50%; }
            100% { background-position: 200% 50%; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="pdf-compile-anim-card">
      {/* Background Holographic Glow effect */}
      <div className="glow-backdrop" />

      {/* Top Graphic: Futuristic Laser Card Printing Simulation */}
      <div className="laser-print-stage">
        <div className="orbit-ring orbit-outer" />
        <div className="orbit-ring orbit-inner" />
        
        {/* Animated ID Card Mockup */}
        <div className="card-mockup">
          <div className="card-mockup-header">
            <div className="mockup-avatar" />
            <div className="mockup-lines">
              <div className="mock-line w-70" />
              <div className="mock-line w-40" />
            </div>
          </div>
          <div className="card-mockup-body">
            <div className="mock-line w-90" />
            <div className="mock-line w-60" />
          </div>

          {/* Laser Scanner Line */}
          <div className="laser-beam" />
        </div>

        <div className="sparkle-particle p1"><Sparkles size={12} color="#818cf8" /></div>
        <div className="sparkle-particle p2"><Zap size={10} color="#fbbf24" /></div>
      </div>

      {/* Main Title & Live Phase Status */}
      <div className="status-text-area">
        <h4 className="title-text">
          <Cpu size={16} className="cpu-icon" /> {message}
        </h4>
        <p className="sub-text">{subMessage || currentPhase.text}</p>
      </div>

      {/* Animated Glowing Progress Bar */}
      <div className="progress-section">
        <div className="progress-track">
          <div
            className="progress-fill-glow"
            style={{ width: `${Math.min(100, Math.max(4, progress))}%` }}
          />
        </div>
        <div className="progress-meta">
          <span className="phase-indicator">
            Phase {currentPhase.stage}/4: {currentPhase.text}
          </span>
          <span className="percentage-badge">{Math.round(progress)}%</span>
        </div>
      </div>

      {/* 4 Step Progress Pills */}
      <div className="steps-row">
        {[
          { num: 1, label: 'Assets' },
          { num: 2, label: 'Vector Engine' },
          { num: 3, label: 'Grid Layout' },
          { num: 4, label: 'PDF Export' },
        ].map((s) => {
          const isDone = currentPhase.stage > s.num;
          const isCurrent = currentPhase.stage === s.num;
          return (
            <div
              key={s.num}
              className={`step-pill ${isDone ? 'done' : isCurrent ? 'active' : 'pending'}`}
            >
              {isDone ? (
                <CheckCircle2 size={12} color="#10b981" />
              ) : (
                <span className="step-num">{s.num}</span>
              )}
              <span className="step-label">{s.label}</span>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .pdf-compile-anim-card {
          position: relative;
          background: rgba(13, 17, 30, 0.95);
          border: 1px solid rgba(99, 102, 241, 0.4);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6), 0 0 25px rgba(99, 102, 241, 0.2);
          border-radius: 16px;
          padding: 24px;
          color: #fff;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 18px;
          overflow: hidden;
          font-family: system-ui, -apple-system, sans-serif;
        }

        .glow-backdrop {
          position: absolute;
          top: -40%;
          left: 50%;
          transform: translateX(-50%);
          width: 240px;
          height: 240px;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.1) 50%, transparent 70%);
          filter: blur(25px);
          pointer-events: none;
        }

        .laser-print-stage {
          position: relative;
          width: 140px;
          height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 6px;
        }

        .orbit-ring {
          position: absolute;
          border-radius: 50%;
          border: 1.5px dashed transparent;
          pointer-events: none;
        }

        .orbit-outer {
          inset: -10px;
          border-top-color: rgba(99, 102, 241, 0.6);
          border-bottom-color: rgba(168, 85, 247, 0.6);
          animation: spinClockwise 8s linear infinite;
        }

        .orbit-inner {
          inset: -2px;
          border-left-color: rgba(236, 72, 153, 0.6);
          border-right-color: rgba(59, 130, 246, 0.6);
          animation: spinCounterClockwise 5s linear infinite;
        }

        .card-mockup {
          position: relative;
          width: 90px;
          height: 56px;
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95));
          border: 1px solid rgba(99, 102, 241, 0.5);
          border-radius: 6px;
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
          overflow: hidden;
        }

        .card-mockup-header {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .mockup-avatar {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: rgba(99, 102, 241, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .mockup-lines {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .mock-line {
          height: 3px;
          background: rgba(255, 255, 255, 0.25);
          border-radius: 2px;
        }

        .w-70 { width: 70%; }
        .w-40 { width: 40%; }
        .w-90 { width: 90%; }
        .w-60 { width: 60%; }

        .card-mockup-body {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .laser-beam {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: #38bdf8;
          box-shadow: 0 0 8px #38bdf8, 0 0 15px #818cf8;
          animation: laserScan 1.8s ease-in-out infinite alternate;
        }

        .sparkle-particle {
          position: absolute;
          pointer-events: none;
        }
        .p1 { top: 0; right: 0; animation: floatParticle 2.5s ease-in-out infinite alternate; }
        .p2 { bottom: 5px; left: 0; animation: floatParticle 3s ease-in-out infinite alternate-reverse; }

        .status-text-area {
          text-align: center;
          width: 100%;
        }

        .title-text {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 700;
          color: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        :global(.cpu-icon) {
          color: #818cf8;
          animation: pulseGlow 1.5s ease-in-out infinite;
        }

        .sub-text {
          margin: 4px 0 0;
          font-size: 0.78rem;
          color: rgba(255, 255, 255, 0.6);
        }

        .progress-section {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .progress-track {
          width: 100%;
          height: 8px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 4px;
          overflow: hidden;
          position: relative;
        }

        .progress-fill-glow {
          height: 100%;
          background: linear-gradient(90deg, #6366f1, #a855f7, #ec4899, #6366f1);
          background-size: 200% 100%;
          border-radius: 4px;
          box-shadow: 0 0 12px rgba(168, 85, 247, 0.6);
          animation: gradientShimmer 2s linear infinite;
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .progress-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.72rem;
        }

        .phase-indicator {
          color: rgba(255, 255, 255, 0.55);
          font-weight: 500;
        }

        .percentage-badge {
          color: #a855f7;
          font-weight: 700;
          font-family: monospace;
        }

        .steps-row {
          display: flex;
          gap: 6px;
          width: 100%;
        }

        .step-pill {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 5px 6px;
          border-radius: 6px;
          font-size: 0.68rem;
          font-weight: 600;
          border: 1px solid transparent;
          transition: all 0.2s ease;
        }

        .step-pill.done {
          background: rgba(16, 185, 129, 0.12);
          border-color: rgba(16, 185, 129, 0.3);
          color: #34d399;
        }

        .step-pill.active {
          background: rgba(99, 102, 241, 0.2);
          border-color: rgba(99, 102, 241, 0.5);
          color: #a5b4fc;
          box-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
        }

        .step-pill.pending {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.4);
        }

        .step-num {
          font-size: 0.65rem;
          opacity: 0.8;
        }

        @keyframes spinClockwise {
          to { transform: rotate(360deg); }
        }
        @keyframes spinCounterClockwise {
          to { transform: rotate(-360deg); }
        }
        @keyframes laserScan {
          0% { top: 0; }
          100% { top: calc(100% - 2px); }
        }
        @keyframes pulseGlow {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.15); opacity: 1; filter: drop-shadow(0 0 6px #818cf8); }
        }
        @keyframes gradientShimmer {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes floatParticle {
          0% { transform: translateY(0px) rotate(0deg); }
          100% { transform: translateY(-8px) rotate(15deg); }
        }
      `}</style>
    </div>
  );
}
