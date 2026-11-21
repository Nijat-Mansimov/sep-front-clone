import { Download, Image as ImageIcon, Sparkles } from 'lucide-react';
import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { ErrorBanner } from '../components/ui/ErrorBanner';

interface GeneratedAsset {
  id: string;
  prompt: string;
  imageUrl: string;
  imageSize: '1K' | '2K' | '4K';
  aspectRatio: string;
  createdAt: string;
}

const IMAGE_SIZES: Array<'1K' | '2K' | '4K'> = ['1K', '2K', '4K'];
const ASPECT_RATIOS = ['16:9', '4:3', '1:1', '3:4', '9:16'] as const;

export function AiStudioPage() {
  const [prompt, setPrompt] = useState(
    'Clean technical isometric architectural diagram of an enterprise security telemetry pipeline flowing from endpoint sensors through a private network connector into an encrypted SIEM analytics core, dark slate background with teal and amber data lines',
  );
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [gallery, setGallery] = useState<GeneratedAsset[]>([]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || isGenerating) return;

    setError(null);
    setIsGenerating(true);
    try {
      const res = await fetch('/api/gemini/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed,
          imageSize,
          aspectRatio,
        }),
      });
      const data = (await res.json()) as {
        imageUrl?: string;
        imageSize?: '1K' | '2K' | '4K';
        aspectRatio?: string;
        error?: string;
      };
      if (!res.ok || !data.imageUrl) {
        throw new Error(data.error || `Image generation failed (${res.status})`);
      }

      setGallery((prev) => [
        {
          id: `img-${Date.now()}`,
          prompt: trimmed,
          imageUrl: data.imageUrl!,
          imageSize: data.imageSize ?? imageSize,
          aspectRatio: data.aspectRatio ?? aspectRatio,
          createdAt: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to generate image'));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="pb-4 border-b border-[var(--border-muted)] flex items-center gap-2.5">
        <ImageIcon className="w-6 h-6 text-[var(--accent)]" />
        <div>
          <h1 className="font-display text-xl font-bold text-[var(--fg-default)]">
            Security Visual Studio
          </h1>
          <p className="text-xs text-[var(--fg-muted)]">
            Generate high-resolution architecture visuals and threat briefs using <code className="font-mono">gemini-3-pro-image-preview</code> at 1K, 2K, or 4K resolution.
          </p>
        </div>
      </div>

      {error && <ErrorBanner error={error} />}

      <form
        onSubmit={handleGenerate}
        className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 space-y-4"
      >
        <div>
          <label htmlFor="studio-prompt" className="block text-xs font-semibold text-[var(--fg-default)] mb-1.5">
            Visual Prompt
          </label>
          <textarea
            id="studio-prompt"
            rows={3}
            required
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the security architecture diagram or brief illustration to generate…"
            className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border-default)] bg-[var(--bg-canvas)] text-[var(--fg-default)]"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <span className="block text-xs font-medium text-[var(--fg-muted)] mb-1">Output Resolution</span>
              <div className="inline-flex rounded-md border border-[var(--border-default)] bg-[var(--bg-canvas)] p-0.5">
                {IMAGE_SIZES.map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setImageSize(sz)}
                    className={`px-3 py-1 text-xs font-mono font-semibold rounded cursor-pointer ${
                      imageSize === sz
                        ? 'bg-[var(--brand-primary)] text-[var(--fg-on-emphasis)]'
                        : 'text-[var(--fg-muted)] hover:text-[var(--fg-default)]'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="studio-aspect" className="block text-xs font-medium text-[var(--fg-muted)] mb-1">
                Aspect Ratio
              </label>
              <select
                id="studio-aspect"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="px-3 py-1.5 text-xs font-mono rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)]"
              >
                {ASPECT_RATIOS.map((ar) => (
                  <option key={ar} value={ar}>
                    {ar}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button type="submit" variant="primary" disabled={isGenerating || !prompt.trim()}>
            <Sparkles className="w-4 h-4" />
            <span>{isGenerating ? `Generating (${imageSize})…` : `Generate ${imageSize} Image`}</span>
          </Button>
        </div>
      </form>

      {gallery.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-12 text-center text-sm text-[var(--fg-muted)]">
          Generated 1K, 2K, and 4K visuals will appear here with download controls.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {gallery.map((asset) => (
            <div
              key={asset.id}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden flex flex-col"
            >
              <div className="bg-black/20 flex items-center justify-center">
                <img src={asset.imageUrl} alt={asset.prompt} className="w-full h-auto object-contain max-h-[420px]" />
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-[var(--fg-muted)]">
                  <span>
                    {asset.imageSize} · {asset.aspectRatio}
                  </span>
                  <span>{asset.createdAt}</span>
                </div>
                <p className="text-xs text-[var(--fg-default)] line-clamp-2">{asset.prompt}</p>
                <div className="pt-1">
                  <a
                    href={asset.imageUrl}
                    download={`sep-visual-${asset.imageSize.toLowerCase()}.png`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-subtle)] text-[var(--fg-default)]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PNG</span>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
