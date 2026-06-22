/**
 * Level Forge - Variant 3 shell.
 *
 * Self-contained level-authoring studio. Routes between:
 *   library -> create wizard -> (save) -> library
 *   library -> edit workspace -> (save) -> library
 *   library -> standalone play view
 */

import React, { useEffect, useState, useCallback } from 'react';
import { ForgeLevel } from '../../forge/types';
import { listLevels, saveLevel, deleteLevel } from '../../forge/db';
import { LibraryPage } from './LibraryPage';
import { CreateWizard } from './CreateWizard';
import { EditWorkspace } from './EditWorkspace';
import { PlayView } from './PlayView';

type View = 'library' | 'create' | 'edit' | 'play';

interface LevelForgeProps {
  onExit: () => void;
}

export const LevelForge: React.FC<LevelForgeProps> = ({ onExit }) => {
  const [view, setView] = useState<View>('library');
  const [levels, setLevels] = useState<ForgeLevel[]>([]);
  const [campaign, setCampaign] = useState<ForgeLevel[]>([]);
  const [active, setActive] = useState<ForgeLevel | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await listLevels();
    setLevels(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Lazy-load the baked 30-level campaign as its own chunk (keeps the main bundle lean).
  useEffect(() => {
    let alive = true;
    import('../../forge/campaignLevels')
      .then((m) => {
        if (alive) setCampaign(m.CAMPAIGN_LEVELS);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const handleSave = async (level: ForgeLevel) => {
    await saveLevel(level);
    await refresh();
    setView('library');
    setActive(null);
  };

  const handleDelete = async (id: string) => {
    await deleteLevel(id);
    await refresh();
  };

  const handleImport = async (raw: string) => {
    try {
      const parsed = JSON.parse(raw) as ForgeLevel;
      if (!parsed.queues || !parsed.params || !parsed.customers) {
        throw new Error('Not a valid Forge level file.');
      }
      // Re-key on import to avoid clobbering an existing level.
      const imported: ForgeLevel = {
        ...parsed,
        id: `kzl-import-${Date.now().toString(36)}`,
        name: `${parsed.name} (imported)`,
        updatedAt: new Date().toISOString(),
      };
      await saveLevel(imported);
      await refresh();
      return true;
    } catch {
      return false;
    }
  };

  const openEdit = (level: ForgeLevel) => {
    setActive(level);
    setView('edit');
  };

  const openPlay = (level: ForgeLevel) => {
    setActive(level);
    setView('play');
  };

  return (
    <div
      className="w-full h-screen max-h-screen overflow-hidden text-slate-800 antialiased"
      style={{
        background:
          'radial-gradient(1200px 600px at 50% -10%, #ffffff 0%, #eef0f4 45%, #e3e6ec 100%)',
      }}
    >
      {view === 'library' && (
        <LibraryPage
          levels={levels}
          campaign={campaign}
          loading={loading}
          onCreate={() => {
            setActive(null);
            setView('create');
          }}
          onPlay={openPlay}
          onEdit={openEdit}
          onDelete={handleDelete}
          onImport={handleImport}
          onExit={onExit}
        />
      )}

      {view === 'create' && (
        <CreateWizard
          onCancel={() => setView('library')}
          onSave={handleSave}
        />
      )}

      {view === 'edit' && active && (
        <EditWorkspace
          level={active}
          onCancel={() => {
            setView('library');
            setActive(null);
          }}
          onSave={handleSave}
          onPlay={openPlay}
        />
      )}

      {view === 'play' && active && (
        <PlayView
          level={active}
          onExit={() => {
            setView('library');
            setActive(null);
          }}
        />
      )}
    </div>
  );
};
