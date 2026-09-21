import { toast } from '@components/ui/toast';
import { exportFeedsToOPML } from '@lib/utils/opml';
import type { FolderResponse, SubscriptionResponse } from '@readspace/shared';
import { useState } from 'react';

/** Share the user's regular feeds as an OPML file; tracks whether it has been exported yet. */
export function useOpmlExport(
  feeds: SubscriptionResponse[],
  folders: FolderResponse[],
  filename: string
) {
  const [hasExported, setHasExported] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const exportOpml = async () => {
    setIsExporting(true);
    try {
      await exportFeedsToOPML(
        feeds.map((sub) => ({
          url: sub.feed.url,
          title: sub.custom_title || sub.feed.title,
          link: sub.feed.link,
          folder_id: sub.folder?.id,
        })),
        folders,
        filename
      );
      setHasExported(true);
    } catch (error) {
      console.error('[PlanChange] OPML export failed:', error);
      toast.error("Couldn't export your feeds. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return { hasExported, isExporting, exportOpml };
}
