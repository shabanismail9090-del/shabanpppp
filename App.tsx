import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { translateText } from './services/geminiService';
import type { Language, InputMode } from './types';

// Add pdfjs-dist types to window for TypeScript
declare global {
    interface Window {
        pdfjsLib: any;
    }
}

// SVG Icon Components defined within App.tsx to avoid extra files
const SwapIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
  </svg>
);

const CopyIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 4.625v2.625a2.625 2.625 0 11-5.25 0v-2.625m5.25 0V12.5" />
  </svg>
);

const UploadIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-3.75 3.75M12 9.75l3.75 3.75M3 17.25V21h18v-3.75M4.5 12a7.5 7.5 0 0115 0v4.5" />
    </svg>
);

const Spinner: React.FC<{}> = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-800 bg-opacity-50 z-10">
      <div className="w-12 h-12 border-4 border-slate-400 border-t-sky-400 rounded-full animate-spin"></div>
    </div>
);


// Main App Component
export default function App() {
  const [sourceLang, setSourceLang] = useState<Language>('arabic');
  const [targetLang, setTargetLang] = useState<Language>('english');
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [inputText, setInputText] = useState<string>('');
  const [translatedText, setTranslatedText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  
  useEffect(() => {
    // Configure the worker for pdf.js
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
    }
  }, []);

  const languageNames = useMemo(() => ({
      arabic: 'Arabic',
      english: 'English',
  }), []);

  const handleTranslate = useCallback(async () => {
    if (!inputText.trim()) {
      setTranslatedText('');
      return;
    }
    setIsLoading(true);
    setError(null);
    setTranslatedText('');

    try {
      const result = await translateText(inputText, sourceLang, targetLang);
      setTranslatedText(result);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("An unknown error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [inputText, sourceLang, targetLang]);

  const handleSwapLanguages = useCallback(() => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setInputText(translatedText);
    setTranslatedText(inputText);
  }, [sourceLang, targetLang, inputText, translatedText]);
  
  const handleCopy = useCallback(() => {
    if (translatedText) {
        navigator.clipboard.writeText(translatedText).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        });
    }
  }, [translatedText]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(null);
    setInputText('');
    setTranslatedText('');

    if (file.size > 100 * 1024 * 1024) {
        setError("File size exceeds 100MB limit.");
        return;
    }
    if (file.type !== 'application/pdf') {
        setError("Only PDF files are supported.");
        return;
    }

    setFileName(file.name);
    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
        if (!event.target?.result || !window.pdfjsLib) {
            setError("Failed to read file or PDF library is not loaded.");
            setIsLoading(false);
            return;
        }

        try {
            const typedArray = new Uint8Array(event.target.result as ArrayBuffer);
            const pdf = await window.pdfjsLib.getDocument(typedArray).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map((s: any) => s.str).join(' ');
                fullText += pageText + '\n\n';
            }
            setInputText(fullText.trim());
            setInputMode('text'); // Switch to text view to show extracted content
        } catch (pdfError) {
            console.error("PDF parsing error:", pdfError);
            setError("Failed to extract text from PDF. The file might be corrupted, password-protected, or contain only images.");
        } finally {
            setIsLoading(false);
        }
    };
    reader.onerror = () => {
        setError("An error occurred while reading the file.");
        setIsLoading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const isRtl = sourceLang === 'arabic';
  const isTargetRtl = targetLang === 'arabic';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-inter p-4 sm:p-6 lg:p-8 flex flex-col">
      <header className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">
          AI Translator Pro
        </h1>
        <p className="text-slate-400 mt-2">Instant Arabic-English translation powered by Gemini</p>
      </header>
      
      <main className="flex-grow flex flex-col gap-6">
        <div className="w-full max-w-5xl mx-auto flex items-center justify-center gap-4 px-4">
            <span className={`text-lg font-semibold ${isRtl ? 'font-cairo' : ''}`}>{languageNames[sourceLang]}</span>
            <button 
                onClick={handleSwapLanguages}
                className="p-2 rounded-full bg-slate-700 hover:bg-sky-500 text-slate-300 hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
                aria-label="Swap languages"
            >
                <SwapIcon className="w-6 h-6" />
            </button>
            <span className={`text-lg font-semibold ${isTargetRtl ? 'font-cairo' : ''}`}>{languageNames[targetLang]}</span>
        </div>

        <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 flex-grow">
          {/* Input Panel */}
          <div className="flex flex-col bg-slate-800 rounded-xl shadow-lg">
              <div className="flex border-b border-slate-700">
                  <button onClick={() => setInputMode('text')} className={`flex-1 p-3 font-semibold transition-colors duration-200 ${inputMode === 'text' ? 'bg-sky-500 text-white' : 'hover:bg-slate-700'}`}>Text</button>
                  <button onClick={() => setInputMode('file')} className={`flex-1 p-3 font-semibold transition-colors duration-200 ${inputMode === 'file' ? 'bg-sky-500 text-white' : 'hover:bg-slate-700'}`}>PDF Document</button>
              </div>
              <div className="p-4 flex-grow flex flex-col">
                  {inputMode === 'text' ? (
                      <textarea
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          placeholder={sourceLang === 'arabic' ? 'اكتب النص هنا...' : 'Enter text here...'}
                          className={`w-full h-full min-h-[300px] flex-grow bg-transparent text-slate-200 placeholder-slate-500 focus:outline-none resize-none text-lg ${isRtl ? 'text-right font-cairo' : 'text-left'}`}
                          dir={isRtl ? 'rtl' : 'ltr'}
                      />
                  ) : (
                      <div className="flex flex-col items-center justify-center h-full min-h-[300px] border-2 border-dashed border-slate-600 rounded-lg p-6">
                           <UploadIcon className="w-16 h-16 text-slate-500 mb-4"/>
                          <p className="text-slate-400 mb-2">Drag & drop a PDF file or</p>
                          <label htmlFor="file-upload" className="cursor-pointer bg-slate-700 text-sky-300 font-semibold py-2 px-4 rounded-md hover:bg-slate-600 transition-colors duration-200">
                              Choose File
                          </label>
                          <input id="file-upload" type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
                          <p className="text-xs text-slate-500 mt-4">Max file size: 100MB</p>
                          {fileName && <p className="text-sm text-green-400 mt-2">Processing: {fileName}</p>}
                      </div>
                  )}
              </div>
              <div className="p-4 border-t border-slate-700">
                  <button
                      onClick={handleTranslate}
                      disabled={isLoading || !inputText}
                      className="w-full bg-sky-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-sky-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
                  >
                      {isLoading ? 'Translating...' : 'Translate'}
                  </button>
              </div>
          </div>

          {/* Output Panel */}
          <div className="flex flex-col bg-slate-800 rounded-xl shadow-lg relative">
              {isLoading && <Spinner />}
              <div className="p-4 flex-grow relative">
                <div 
                  className={`w-full h-full min-h-[300px] text-slate-300 text-lg whitespace-pre-wrap ${isTargetRtl ? 'text-right font-cairo' : 'text-left'}`} 
                  dir={isTargetRtl ? 'rtl' : 'ltr'}
                >
                  {translatedText || (!isLoading && <span className="text-slate-500">Translation will appear here...</span>)}
                </div>
                {translatedText && (
                    <button 
                        onClick={handleCopy}
                        className="absolute top-4 right-4 p-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-sky-300 transition-colors"
                        aria-label="Copy translated text"
                    >
                        {copySuccess ? 'Copied!' : <CopyIcon className="w-5 h-5" />}
                    </button>
                )}
              </div>
              {error && (
                <div className="p-4 border-t border-red-500 bg-red-900 bg-opacity-30 text-red-300 text-sm">
                  <p><span className="font-bold">Error:</span> {error}</p>
                </div>
              )}
          </div>
        </div>
      </main>
      
      <footer className="text-center text-slate-500 text-sm mt-8">
        <p>&copy; {new Date().getFullYear()} AI Translator Pro. Built with React, Tailwind CSS, and Google Gemini.</p>
      </footer>
    </div>
  );
}
