'use client';

import { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { getBracket } from '@/app/actions/bracket-entry';
import { buildBracketView, type SlotView } from '@/lib/bracket-view';
import MarchMadnessBracket from '@/app/_components/MarchMadnessBracket';
import { bracketImageFilename, canShareFiles } from '@/lib/bracket-export';
import { useT } from '@/app/_components/LangProvider';
import type { StringKey } from '@/lib/i18n';

export default function BracketExportButton({
  id,
  name,
  complete,
}: {
  id: string;
  name: string;
  complete: boolean;
}) {
  const t = useT();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<StringKey | null>(null);
  const [slots, setSlots] = useState<SlotView[] | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  async function start() {
    setError(null);
    setWorking(true);
    try {
      const { view, error: e } = await getBracket(id);
      if (e || !view) throw new Error('load failed');
      // Picks-only image (no scoring colors): pass empty official winners.
      setSlots(buildBracketView(view.effectiveR32, view.picks, {}));
    } catch {
      setError('bracket.exportFailed');
      setWorking(false);
    }
  }

  // Capture runs after the on-screen (but covered) stage has rendered.
  useEffect(() => {
    if (!slots) return;
    let cancelled = false;
    (async () => {
      try {
        const node = stageRef.current;
        if (!node) throw new Error('no node');
        // Fonts + flag background images must be painted before snapshotting.
        if (document.fonts?.ready) await document.fonts.ready;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

        // Capture at the tree's full natural size. The stage is rendered on-screen
        // (behind an opaque cover) — content positioned far off-screen is not painted
        // by the browser and html-to-image would capture a blank.
        const width = node.scrollWidth;
        const height = node.scrollHeight;
        if (!width || !height) throw new Error('empty stage');

        // skipFonts: html-to-image otherwise reads every stylesheet's cssRules to inline
        // web fonts, which throws a SecurityError on a cross-origin sheet and blanks the
        // whole capture. The bracket renders in a system font; flags/colors/picks intact.
        const opts = { width, height, pixelRatio: 2, cacheBust: true, backgroundColor: '#06150d', skipFonts: true };
        // First pass primes the flag background-image cache; the second renders reliably.
        await toPng(node, opts);
        const dataUrl = await toPng(node, opts);
        if (cancelled) return;

        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], bracketImageFilename(name), { type: 'image/png' });

        let shared = false;
        if (canShareFiles(typeof navigator !== 'undefined' ? navigator : undefined, file)) {
          try {
            await navigator.share({ files: [file], title: name });
            shared = true;
          } catch (err) {
            // User dismissed the share sheet — treat as done, don't also download.
            if ((err as Error)?.name === 'AbortError') shared = true;
          }
        }
        if (!shared && !cancelled) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }
      } catch {
        if (!cancelled) setError('bracket.exportFailed');
      } finally {
        if (!cancelled) {
          setSlots(null);
          setWorking(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [slots, name]);

  if (!complete) return null;

  return (
    <>
      <button type="button" className="btn btn-sm" disabled={working} onClick={start}>
        {working ? t('bracket.exporting') : t('bracket.export')}
      </button>
      {error && (
        <span className="banner error" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 12 }}>
          {t(error)}
        </span>
      )}
      {slots && (
        // On-screen so the browser actually paints it, but covered by an opaque panel so
        // the user never sees the raw bracket flash. html-to-image captures the tree node.
        <div className="brd-export-portal" aria-hidden>
          <div className="brd-export-tree" ref={stageRef}>
            <MarchMadnessBracket slots={slots} layout="static" />
          </div>
          <div className="brd-export-cover">{t('bracket.exporting')}</div>
        </div>
      )}
    </>
  );
}
