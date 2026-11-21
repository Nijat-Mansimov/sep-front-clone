import { BotMessageSquare, Send, Trash2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../components/ui/Button';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { MarkdownView } from '../components/ui/MarkdownView';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  model?: string;
}

const MODELS = [
  { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen (General)' },
  { id: 'gemini-4-carbon', label: 'Gemini 4 Carbon (Deep Reasoning)' },
  { id: 'gemini-4-neon', label: 'Gemini 4 Neon (Complex Interactive)' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite (Fast)' },
] as const;

const ROLE_PRESETS = [
  {
    id: 'detection-engineer',
    label: 'Detection Engineer',
    prompt:
      'You are a senior detection engineering specialist helping analysts author, validate, and tune Sigma and SEP Detection v1 YAML rules with low false-positive rates.',
  },
  {
    id: 'attck-mapper',
    label: 'ATT&CK Strategist',
    prompt:
      'You are a threat intelligence and MITRE ATT&CK specialist. Map observed adversary behaviors to exact ATT&CK tactics, techniques, sub-techniques, and telemetry data sources.',
  },
  {
    id: 'query-translator',
    label: 'SIEM Dialect Architect',
    prompt:
      'You are a SIEM/XDR query language expert specializing in KQL, Splunk SPL, Cortex XQL, and Sigma field normalization.',
  },
];

export function AiAssistantPage() {
  const [model, setModel] = useState<string>('gemini-4-hydrogen');
  const [presetId, setPresetId] = useState<string>('detection-engineer');
  const [systemInstruction, setSystemInstruction] = useState<string>(ROLE_PRESETS[0].prompt);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handlePresetChange = (id: string) => {
    setPresetId(id);
    const found = ROLE_PRESETS.find((p) => p.id === id);
    if (found) setSystemInstruction(found.prompt);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    setError(null);
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text: trimmed };
    const nextHistory = messages.map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          systemInstruction,
          history: nextHistory,
          message: trimmed,
        }),
      });
      const data = (await res.json()) as { reply?: string; model?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || `Chat request failed (${res.status})`);
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          role: 'model',
          text: data.reply || 'No response returned.',
          model: data.model ?? model,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to send message'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--border-muted)]">
        <div className="flex items-center gap-2.5">
          <BotMessageSquare className="w-6 h-6 text-[var(--brand-primary)]" />
          <div>
            <h1 className="font-display text-xl font-bold text-[var(--fg-default)]">
              Detection Engineering AI Assistant
            </h1>
            <p className="text-xs text-[var(--fg-muted)]">
              Multi-turn Gemini thread with role-scoped system instructions for rule authoring and ATT&amp;CK analysis.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="Select Gemini model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)]"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          {messages.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setMessages([])}>
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear thread</span>
            </Button>
          )}
        </div>
      </div>

      {error && <ErrorBanner error={error} />}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* System Instruction Role Panel */}
        <aside className="lg:col-span-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-3 h-fit">
          <div>
            <label htmlFor="ai-role-preset" className="block text-xs font-semibold text-[var(--fg-default)] mb-1">
              Assistant Role Preset
            </label>
            <select
              id="ai-role-preset"
              value={presetId}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-surface)]"
            >
              {ROLE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ai-system-instruction" className="block text-xs font-semibold text-[var(--fg-default)] mb-1">
              System Instruction
            </label>
            <textarea
              id="ai-system-instruction"
              rows={6}
              value={systemInstruction}
              onChange={(e) => setSystemInstruction(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-canvas)] text-[var(--fg-default)]"
            />
          </div>

          <div className="space-y-1.5 pt-2 border-t border-[var(--border-muted)]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
              Sample Prompts
            </div>
            {[
              'Write a SEP v1 KQL rule detecting LSASS memory dumps via comsvcs.dll.',
              'Explain differences between Splunk SPL tstats and Cortex XQL dataset filters.',
              'Map Kerberoasting (T1558.003) telemetry fields across Windows Event 4769.',
            ].map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setInput(prompt)}
                className="w-full text-left p-2 rounded border border-[var(--border-muted)] bg-[var(--bg-canvas)] hover:border-[var(--brand-primary)] text-[11px] text-[var(--fg-default)] cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
        </aside>

        {/* Scrollable Multi-turn Thread */}
        <div className="lg:col-span-3 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] flex flex-col h-[600px]">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-sm text-[var(--fg-muted)] px-6">
                <BotMessageSquare className="w-9 h-9 mb-3 text-[var(--brand-primary)] opacity-80" />
                <div className="font-semibold text-[var(--fg-default)]">Start a multi-turn detection engineering session</div>
                <p className="text-xs mt-1 max-w-md">
                  Conversation history is preserved across turns so you can iteratively refine queries, field mappings, and false-positive exclusions.
                </p>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-md border p-3.5 text-sm ${
                      m.role === 'user'
                        ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-subtle)] text-[var(--fg-default)]'
                        : 'border-[var(--border-default)] bg-[var(--bg-canvas)] text-[var(--fg-default)]'
                    }`}
                  >
                    <div className="text-[11px] font-mono text-[var(--fg-muted)] mb-1">
                      {m.role === 'user' ? 'You' : m.model ?? model}
                    </div>
                    {m.role === 'user' ? (
                      <div className="whitespace-pre-wrap">{m.text}</div>
                    ) : (
                      <MarkdownView content={m.text} />
                    )}
                  </div>
                </div>
              ))
            )}
            {isSending && (
              <div className="flex justify-start">
                <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-canvas)] px-4 py-3 text-xs font-mono text-[var(--fg-muted)]">
                  Thinking with {model}…
                </div>
              </div>
            )}
            <div ref={threadEndRef} />
          </div>

          <form
            onSubmit={handleSend}
            className="border-t border-[var(--border-muted)] bg-[var(--bg-subtle)] p-3 flex items-end gap-2"
          >
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder="Ask about detection rules, query translation, or ATT&CK coverage…"
              className="flex-1 px-3 py-2 text-sm rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)] resize-none"
            />
            <Button type="submit" variant="primary" disabled={isSending || !input.trim()}>
              <Send className="w-4 h-4" />
              <span>Send</span>
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
