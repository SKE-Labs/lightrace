"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}

export default function SettingsPage() {
  const utils = trpc.useUtils();
  const { data: apiKeys, isLoading } = trpc.settings.listApiKeys.useQuery();
  const { data: projects } = trpc.settings.listProjects.useQuery();
  const createMutation = trpc.settings.createApiKey.useMutation({
    onSuccess: () => utils.settings.listApiKeys.invalidate(),
  });
  const deleteMutation = trpc.settings.deleteApiKey.useMutation({
    onSuccess: () => utils.settings.listApiKeys.invalidate(),
  });

  const [newKeyResult, setNewKeyResult] = useState<{
    publicKey: string;
    secretKey: string;
  } | null>(null);
  const [note, setNote] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleCreate = async () => {
    if (!projects?.[0]) return;
    const result = await createMutation.mutateAsync({
      projectId: projects[0].id,
      note: note || undefined,
    });
    setNewKeyResult(result);
    setNote("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold">Settings</h1>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium">API Keys</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Use these keys with the Lightrace SDK to send traces.
              </p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger render={<Button size="sm" />} onClick={() => setNewKeyResult(null)}>
                Create Key
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>{newKeyResult ? "API Key Created" : "Create API Key"}</DialogTitle>
                </DialogHeader>
                {!newKeyResult ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-muted-foreground">Note (optional)</label>
                      <Input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="e.g. Development"
                      />
                    </div>
                    <Button onClick={handleCreate} disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Creating..." : "Create"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      Save these keys now. The secret key will not be shown again.
                    </p>
                    <div>
                      <label className="text-xs text-muted-foreground">Public Key</label>
                      <div className="flex items-center gap-2 mt-1 rounded bg-muted p-2">
                        <code className="text-xs font-mono break-all flex-1">
                          {newKeyResult.publicKey}
                        </code>
                        <CopyButton value={newKeyResult.publicKey} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Secret Key</label>
                      <div className="flex items-center gap-2 mt-1 rounded bg-muted p-2">
                        <code className="text-xs font-mono break-all flex-1">
                          {newKeyResult.secretKey}
                        </code>
                        <CopyButton value={newKeyResult.secretKey} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">SDK Usage</label>
                      <pre className="mt-1 rounded bg-muted p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                        {`from lightrace import Lightrace

lt = Lightrace(
    public_key="${newKeyResult.publicKey}",
    secret_key="${newKeyResult.secretKey}",
    host="http://localhost:3002"
)`}
                      </pre>
                    </div>
                    <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                      Done
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>

          <div className="rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Public Key</th>
                  <th className="px-4 py-2 text-left font-medium">Secret Key</th>
                  <th className="px-4 py-2 text-left font-medium">Note</th>
                  <th className="px-4 py-2 text-left font-medium">Created</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                )}
                {apiKeys?.map((key) => (
                  <tr key={key.id} className="border-b border-border/50">
                    <td className="px-4 py-2 font-mono text-xs">{key.publicKey}</td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {key.displaySecretKey}
                    </td>
                    <td className="px-4 py-2">{key.note || "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate({ id: key.id })}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
                {apiKeys?.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No API keys. Create one to start sending traces.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
