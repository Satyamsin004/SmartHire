import React, { useState } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { Award, Play, CheckCircle2, Code } from 'lucide-react';

export const CodingRoundPage: React.FC = () => {
  const [code, setCode] = useState(`def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            return [seen[diff], i]
        seen[num] = i
    return []
`);
  const [output, setOutput] = useState<string | null>(null);

  const handleRun = () => {
    setOutput("Executing test cases...\n[PASS] Test Case 1: nums=[2,7,11,15], target=9 -> Output: [0, 1]\n[PASS] Test Case 2: nums=[3,2,4], target=6 -> Output: [1, 2]\nAll test cases passed! Execution time: 12ms.");
  };

  return (
    <div className="min-h-screen bg-brand-bg flex text-brand-ink">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />

        <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8">
          
          <div className="bg-gradient-to-r from-brand-primary via-sb-800 to-brand-ink rounded-5xl p-8 text-white flex justify-between items-center shadow-floating">
            <div>
              <span className="text-xs font-extrabold text-brand-accent uppercase tracking-wider">Live Coding Assessment Studio</span>
              <h1 className="text-3xl font-extrabold text-white mt-1">Two Sum Algorithm Challenge</h1>
            </div>
            <button
              onClick={handleRun}
              className="px-6 py-3.5 rounded-2xl bg-brand-secondary hover:bg-sb-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-luxury"
            >
              <Play className="w-4 h-4" />
              <span>Run Automated Tests</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 card-luxury p-6 space-y-4">
              <h4 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider">Python 3 Code Editor</h4>
              <textarea
                rows={12}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full font-mono bg-brand-ink text-brand-accent p-4 rounded-2xl text-xs focus:outline-none"
              />
            </div>

            <div className="lg:col-span-5 card-luxury p-6 space-y-4">
              <h4 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider">Test Execution Console</h4>
              {output ? (
                <pre className="p-4 rounded-2xl bg-cream-100 border border-stoneBorder font-mono text-xs text-brand-primary whitespace-pre-wrap">
                  {output}
                </pre>
              ) : (
                <div className="py-12 text-center border-2 border-dashed border-stoneBorder rounded-2xl bg-cream-100">
                  <p className="text-xs text-slate-400 font-bold">Click "Run Automated Tests" to execute solution against test suite.</p>
                </div>
              )}
            </div>
          </div>

        </main>
      </div>
    </div>
  );
};
