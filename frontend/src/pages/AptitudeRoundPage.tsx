import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Navbar } from '../components/layout/Navbar';
import { BrainCircuit, CheckCircle2, Clock, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';

export const AptitudeRoundPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const questions = [
    {
      id: 'apt-101',
      category: 'Quantitative Ability',
      question: 'A train 150 meters long takes 20 seconds to cross a platform 250 meters long. What is the speed of the train in km/h?',
      options: ['54 km/h', '72 km/h', '90 km/h', '108 km/h'],
      correct: 1
    },
    {
      id: 'apt-102',
      category: 'Logical Reasoning',
      question: 'If "CODES" is written as "DPEFT" in a certain language, how is "INTERVIEW" written in that language?',
      options: ['JOUSSWJFX', 'JOUSUJXJX', 'JOUSFJXJX', 'JOUSVJXJX'],
      correct: 0
    },
    {
      id: 'apt-103',
      category: 'Verbal Ability',
      question: 'Identify the word that is opposite in meaning to "EPHEMERAL":',
      options: ['Transient', 'Permanent', 'Fleeting', 'Short-lived'],
      correct: 1
    }
  ];

  const handleSelect = (qId: string, idx: number) => {
    setSelectedAnswers({ ...selectedAnswers, [qId]: idx });
  };

  const calculateScore = () => {
    let score = 0;
    questions.forEach((q) => {
      if (selectedAnswers[q.id] === q.correct) {
        score += 1;
      } else if (selectedAnswers[q.id] !== undefined) {
        score -= 0.25;
      }
    });
    return Math.max(0, score);
  };

  return (
    <div className="flex min-h-screen bg-[#FAF7F2]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />

        <main className="p-8 space-y-6 overflow-y-auto max-w-4xl mx-auto w-full">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-black text-[#0F6B4B] uppercase tracking-wider bg-[#E6F7EF] px-3 py-1 rounded-full border border-[#C7EFE0]">
                COGNITIVE & APTITUDE ASSESSMENT
              </span>
              <h1 className="text-3xl font-black text-[#15342A] tracking-tight mt-2">
                Aptitude & Problem Solving Round
              </h1>
            </div>

            <div className="px-4 py-2 bg-white border border-[#E7E5E4] rounded-2xl text-xs font-black text-[#0F6B4B] shadow-xs flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Time Allowed: 15 Mins</span>
            </div>
          </div>

          {submitted ? (
            <div className="bg-white rounded-4xl p-10 border border-[#E7E5E4] shadow-soft text-center space-y-6">
              <div className="w-16 h-16 rounded-3xl bg-[#E6F7EF] text-[#0F6B4B] flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-[#15342A]">Assessment Submitted Successfully!</h3>
                <p className="text-xs text-[#6B7280] font-bold mt-1">Your response metrics have been logged into your candidate dashboard.</p>
              </div>

              <div className="p-6 bg-[#FAF7F2] rounded-3xl border border-[#E7E5E4] inline-block text-center space-y-1">
                <span className="text-xs font-black text-[#6B7280] uppercase">Calculated Score</span>
                <div className="text-4xl font-black text-[#0F6B4B]">{calculateScore()} / {questions.length}</div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="py-3.5 px-8 bg-[#0F6B4B] hover:bg-[#0B543A] text-white font-black text-xs rounded-2xl shadow-md"
                >
                  Return to Candidate Dashboard
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {questions.map((q, qIndex) => (
                <div key={q.id} className="bg-white rounded-3xl p-6 border border-[#E7E5E4] shadow-soft space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 bg-[#E6F7EF] text-[#0F6B4B] rounded-full text-[10px] font-black uppercase">
                      {q.category} · Question {qIndex + 1}
                    </span>
                  </div>

                  <h3 className="text-base font-black text-[#15342A] leading-relaxed">{q.question}</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {q.options.map((opt, optIdx) => {
                      const isSelected = selectedAnswers[q.id] === optIdx;
                      return (
                        <button
                          key={optIdx}
                          onClick={() => handleSelect(q.id, optIdx)}
                          className={`p-4 rounded-2xl text-xs font-black text-left border transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-[#0F6B4B] text-white border-[#0F6B4B] shadow-md'
                              : 'bg-[#FAF7F2] text-[#15342A] border-[#E7E5E4] hover:border-[#2BB673]'
                          }`}
                        >
                          <span>{opt}</span>
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${
                            isSelected ? 'border-white bg-[#6EE7B7] text-[#0F6B4B]' : 'border-[#E7E5E4]'
                          }`}>
                            {String.fromCharCode(65 + optIdx)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="pt-4 flex justify-end">
                <button
                  onClick={() => setSubmitted(true)}
                  className="py-4 px-8 bg-[#0F6B4B] hover:bg-[#0B543A] text-white font-black text-xs rounded-2xl shadow-lg shadow-[#0F6B4B]/20 flex items-center gap-2 transform active:scale-95"
                >
                  Submit Aptitude Test
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
