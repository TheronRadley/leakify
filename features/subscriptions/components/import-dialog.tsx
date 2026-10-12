/**
 * Restore-from-backup dialog.
 *
 * Two steps on purpose: paste → **Check file** shows exactly what would happen
 * (new / already present / unreadable), and only then can anything be written.
 * The user never has to trust that a paste silently did the right thing, and a
 * failed run leaves the original text in the box so it can be retried.
 */
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import {
  analyzeImport,
  type ImportAnalysis,
  type ImportDuplicateStrategy,
} from '@/features/subscriptions/import-export';
import { importSubscriptions, useDataStore } from '@/features/subscriptions/store';
import { Download } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

type Preview = Extract<ImportAnalysis, { ok: true }>;

export function ImportDialog({ onDone }: { onDone: (message: string) => void }) {
  const { subscriptions, scope } = useDataStore();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState('');
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [strategy, setStrategy] = React.useState<ImportDuplicateStrategy>('skip');
  const [busy, setBusy] = React.useState(false);

  const reset = () => {
    setPreview(null);
    setError(null);
  };

  const check = () => {
    reset();
    const result = analyzeImport(text, { existing: subscriptions, scope: scope ?? 'local-user' });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPreview(result);
  };

  const runImport = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const result = await importSubscriptions(preview, strategy);
      setOpen(false);
      setText('');
      reset();
      const parts = [
        result.created > 0 ? `${result.created} restored` : null,
        result.replaced > 0 ? `${result.replaced} updated` : null,
        result.skipped > 0 ? `${result.skipped} skipped` : null,
        result.failed > 0 ? `${result.failed} failed` : null,
      ].filter(Boolean);
      onDone(parts.length ? parts.join(', ') + '.' : 'Nothing to import.');
    } catch {
      setError('Import failed. Your existing data is unchanged — try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Pressable accessibilityRole="button" accessibilityLabel="Restore from backup" className="active:bg-accent/50">
          <View className="flex-row items-center gap-3 p-4">
            <Icon as={Download} size={20} className="text-muted-foreground" />
            <View className="flex-1">
              <Text className="font-medium">Restore from backup</Text>
              <Text variant="small" className="leading-4 text-muted-foreground">
                Paste a previous export. You will see what it contains before anything is saved.
              </Text>
            </View>
          </View>
        </Pressable>
      </DialogTrigger>
      <DialogContent className="gap-3">
        <DialogHeader>
          <DialogTitle>Restore from a Leakify export</DialogTitle>
          <DialogDescription>
            Paste the JSON from “Export my data”. Nothing is written until you confirm.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={text}
          onChangeText={(next) => {
            setText(next);
            reset();
          }}
          placeholder='{"app":"leakify", …}'
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Exported JSON"
          style={{ minHeight: 140 }}
        />

        {error ? (
          <Text variant="small" className="text-destructive" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        {preview ? (
          <View className="gap-2 rounded-md bg-muted p-3">
            <Text variant="small" className="font-semibold">
              {preview.summary}
            </Text>
            {preview.invalid.length > 0 ? (
              <Text variant="small" className="leading-4 text-muted-foreground">
                Unreadable entries are left out:{' '}
                {preview.invalid
                  .slice(0, 3)
                  .map((i) => `${i.name} — ${i.reason}`)
                  .join('; ')}
                {preview.invalid.length > 3 ? `; +${preview.invalid.length - 3} more` : ''}
              </Text>
            ) : null}
            {preview.duplicates.length > 0 ? (
              <View className="flex-row items-center gap-2 pt-1">
                <Text variant="small" className="flex-1 text-muted-foreground">
                  For the {preview.duplicates.length} you already have:
                </Text>
                <Button
                  size="sm"
                  variant={strategy === 'skip' ? 'default' : 'outline'}
                  onPress={() => setStrategy('skip')}
                  accessibilityLabel="Keep existing subscriptions"
                >
                  <Text>Keep mine</Text>
                </Button>
                <Button
                  size="sm"
                  variant={strategy === 'replace' ? 'default' : 'outline'}
                  onPress={() => setStrategy('replace')}
                  accessibilityLabel="Replace with the imported versions"
                >
                  <Text>Use imported</Text>
                </Button>
              </View>
            ) : null}
          </View>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onPress={check} disabled={text.trim().length === 0 || busy}>
            <Text>Check file</Text>
          </Button>
          <Button
            loading={busy}
            disabled={!preview || (preview.toCreate.length === 0 && strategy === 'skip')}
            onPress={() => void runImport()}
            accessibilityLabel="Import subscriptions"
          >
            <Text>Import</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
