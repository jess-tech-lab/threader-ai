import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, ArrowRight, ExternalLink, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FocusArea, SynthesisReportV2 } from '@/types';
import { askThreader } from '@/services/askThreader';

// Custom Thread/Network Icon for Threader AI branding
function ThreadIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Connected nodes pattern */}
      <circle cx="5" cy="6" r="2" />
      <circle cx="19" cy="6" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="5" cy="18" r="2" />
      <circle cx="19" cy="18" r="2" />
      {/* Connecting lines */}
      <path d="M7 6h10" />
      <path d="M5 8v8" />
      <path d="M19 8v8" />
      <path d="M7 18h10" />
      <path d="M7 7l3 3" />
      <path d="M14 9l3-3" />
      <path d="M7 17l3-3" />
      <path d="M14 15l3 3" />
    </svg>
  );
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isFeedbackPanel?: boolean;
  feedbackData?: FocusArea;
}

interface SmartSuggestion {
  label: string;
  query: string;
}

interface AskThreaderPanelProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: SmartSuggestion[];
  selectedFeedback?: FocusArea | null;
  onClearFeedback?: () => void;
  synthesis: SynthesisReportV2 | null;
  companyName: string;
}

// Strip leading/trailing quotes to avoid double-quoting
function cleanQuote(text: string): string {
  return text.replace(/^["'"]+|["'"]+$/g, '').trim();
}

// Simple markdown renderer for AI responses
function renderMarkdown(text: string): string {
  return text
    // Bold text: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic text: *text* or _text_
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    .replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<em>$1</em>')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>')
    // Bullet points
    .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul class="list-disc pl-4 my-2">$1</ul>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
}

// Generate contextual suggestions based on the feedback
function generateFeedbackSuggestions(feedback: FocusArea): SmartSuggestion[] {
  return [
    { label: `Why is this ${feedback.trend === 'up' ? 'rising' : 'trending'}?`, query: `Why is "${feedback.title}" ${feedback.trend === 'up' ? 'rising' : 'trending'}?` },
    { label: 'What caused this issue?', query: `What's the root cause of "${feedback.title}"?` },
    { label: 'How should we prioritize this?', query: `How should we prioritize "${feedback.title}" compared to other issues?` },
  ];
}

export function AskThreaderPanel({ isOpen, onClose, suggestions, selectedFeedback, onClearFeedback, synthesis, companyName }: AskThreaderPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [currentFeedback, setCurrentFeedback] = useState<FocusArea | null>(null);

  // When a new feedback is selected, add it as the first message
  useEffect(() => {
    if (selectedFeedback && selectedFeedback !== currentFeedback) {
      setCurrentFeedback(selectedFeedback);
      // Clear previous messages and add the feedback panel
      setMessages([{
        id: `feedback-${Date.now()}`,
        role: 'assistant',
        content: '',
        isFeedbackPanel: true,
        feedbackData: selectedFeedback,
      }]);
    }
  }, [selectedFeedback, currentFeedback]);

  // Clear messages when panel closes
  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
      setCurrentFeedback(null);
      onClearFeedback?.();
    }
  }, [isOpen, onClearFeedback]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (query: string) => {
    if (!query.trim() || !synthesis) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Call the Ask Threader AI service
      const response = await askThreader({
        question: query,
        selectedFeedback: currentFeedback,
        synthesis,
        companyName,
      });

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer,
      };
      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your question. Please try again.',
      };
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(input);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md z-50 flex flex-col"
          >
            <div className="h-full glass border-l border-border/50 flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <ThreadIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-title">Ask Threader</h2>
                    <p className="text-xs text-muted-foreground">
                      Ask questions about this report
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages / Suggestions */}
              <div className="flex-1 overflow-y-auto p-4">
                {messages.length === 0 ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Try one of these questions:
                    </p>
                    <div className="space-y-2">
                      {suggestions.map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => handleSubmit(suggestion.query)}
                          className="w-full text-left p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm">{suggestion.label}</span>
                            <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${
                          message.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {/* Regular message rendering with markdown support */}
                        {!message.isFeedbackPanel && (
                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                              message.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            {message.role === 'assistant' ? (
                              <div
                                className="text-sm prose prose-sm dark:prose-invert max-w-none [&>p]:my-2 [&>ul]:my-2 [&>ol]:my-2 [&_li]:my-0.5"
                                dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                              />
                            ) : (
                              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            )}
                          </div>
                        )}

                        {/* Special rendering for feedback panel */}
                        {message.isFeedbackPanel && message.feedbackData && (
                          <div className="w-full space-y-4">
                            {/* Original Feedback Header */}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide font-medium">
                              <MessageSquare className="w-3.5 h-3.5" />
                              Original Feedback
                            </div>

                            {/* Feedback Quote - Full text, no truncation, cleaned of extra quotes */}
                            <div className="bg-muted/50 rounded-xl p-4 border-l-4 border-primary">
                              <p
                                className="text-base italic text-foreground leading-relaxed"
                                style={{
                                  wordBreak: 'break-word',
                                  whiteSpace: 'pre-wrap',
                                  overflowWrap: 'break-word'
                                }}
                              >
                                "{cleanQuote(message.feedbackData.topQuote || message.feedbackData.title)}"
                              </p>
                            </div>

                            {/* Metadata */}
                            <div className="flex items-center gap-3 flex-wrap">
                              {/* Subreddit Badge */}
                              {message.feedbackData.subreddit && (
                                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-600">
                                  {message.feedbackData.subreddit}
                                </span>
                              )}

                              {/* Category Badge */}
                              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize">
                                {message.feedbackData.category.replace('_', ' ')}
                              </span>

                              {/* Impact Score */}
                              <span className="text-xs text-muted-foreground">
                                Impact: <span className="font-semibold text-foreground">{message.feedbackData.impactScore.toFixed(1)}</span>
                              </span>

                              {/* Frequency */}
                              <span className="text-xs text-muted-foreground">
                                {message.feedbackData.frequency} mentions
                              </span>
                            </div>

                            {/* Reddit Link - uses actual URL if available */}
                            {message.feedbackData.sourceUrl ? (
                              <a
                                href={message.feedbackData.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                View original post on Reddit
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">
                                Source: Reddit (aggregated from multiple posts)
                              </span>
                            )}

                            {/* Divider */}
                            <div className="border-t border-border/50 pt-4 mt-4">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-3">
                                Ask Threader about this feedback
                              </p>

                              {/* Contextual Suggestions */}
                              <div className="space-y-2">
                                {generateFeedbackSuggestions(message.feedbackData).map((suggestion, i) => (
                                  <button
                                    key={i}
                                    onClick={() => handleSubmit(suggestion.query)}
                                    className="w-full text-left p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors group"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm">{suggestion.label}</span>
                                      <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                    {isLoading && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start"
                      >
                        <div className="bg-muted rounded-2xl px-4 py-2.5">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                      </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="p-4 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about this report..."
                    className="flex-1 bg-muted/50 rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <Button
                    size="icon"
                    onClick={() => handleSubmit(input)}
                    disabled={!input.trim() || isLoading}
                    className="rounded-xl h-11 w-11"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
