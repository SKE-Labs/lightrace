"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useProjectStore } from "@/lib/project-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Copy, Check, UserPlus } from "lucide-react";
import { RoleBadge, isAdmin as checkIsAdmin } from "@/lib/role-config";

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

// --- API Keys Tab ---
function ApiKeysTab() {
  const projectId = useProjectStore((s) => s.projectId)!;
  const role = useProjectStore((s) => s.role);
  const utils = trpc.useUtils();
  const { data: apiKeys, isLoading } = trpc.settings.listApiKeys.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId },
  );
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
  const isAdmin = checkIsAdmin(role);

  const handleCreate = async () => {
    const result = await createMutation.mutateAsync({
      projectId,
      note: note || undefined,
    });
    setNewKeyResult(result);
    setNote("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium">API Keys</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Use these keys with the Lightrace SDK to send traces.
          </p>
        </div>
        {isAdmin && (
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
                    <label className="text-xs text-muted-foreground">Note (optional)</label>
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
                  <p className="text-sm text-warning">
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
    host="http://localhost:3000"
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
        )}
      </div>

      <div className="rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-4 py-3 text-left font-medium">Public Key</th>
              <th className="px-4 py-3 text-left font-medium">Secret Key</th>
              <th className="px-4 py-3 text-left font-medium">Note</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
              {isAdmin && <th className="px-4 py-3 text-right font-medium">Actions</th>}
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
                <td className="px-4 py-3 font-mono text-xs">{key.publicKey}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {key.displaySecretKey}
                </td>
                <td className="px-4 py-3">{key.note || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(key.createdAt).toLocaleDateString()}
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate({ projectId, id: key.id })}
                    >
                      Delete
                    </Button>
                  </td>
                )}
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
  );
}

// --- Members Tab ---
function MembersTab() {
  const projectId = useProjectStore((s) => s.projectId)!;
  const role = useProjectStore((s) => s.role);
  const utils = trpc.useUtils();
  const { data: members, isLoading } = trpc.members.list.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId },
  );
  const { data: invitations } = trpc.members.listInvitations.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId && (role === "OWNER" || role === "ADMIN") },
  );

  const inviteMutation = trpc.members.invite.useMutation({
    onSuccess: () => {
      utils.members.list.invalidate();
      utils.members.listInvitations.invalidate();
      setInviteOpen(false);
      setInviteEmail("");
    },
  });
  const updateRoleMutation = trpc.members.updateRole.useMutation({
    onSuccess: () => utils.members.list.invalidate(),
  });
  const removeMutation = trpc.members.remove.useMutation({
    onSuccess: () => utils.members.list.invalidate(),
  });
  const cancelInviteMutation = trpc.members.cancelInvitation.useMutation({
    onSuccess: () => utils.members.listInvitations.invalidate(),
  });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER" | "VIEWER">("MEMBER");
  const isAdmin = checkIsAdmin(role);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium">Team Members</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Manage who has access to this project.
          </p>
        </div>
        {isAdmin && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
              <UserPlus className="size-4" />
              Invite members
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Invite team members</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "ADMIN" | "MEMBER" | "VIEWER")}
                    className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="MEMBER">Member</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Email address</label>
                  <Input
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="name@example.com"
                    type="email"
                  />
                </div>
                {inviteMutation.error && (
                  <p className="text-xs text-destructive">{inviteMutation.error.message}</p>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setInviteOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() =>
                      inviteMutation.mutate({
                        projectId,
                        email: inviteEmail,
                        role: inviteRole,
                      })
                    }
                    disabled={!inviteEmail || inviteMutation.isPending}
                  >
                    {inviteMutation.isPending ? "Sending..." : "Send invitation"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Members table */}
      <div className="rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-4 py-3 text-left font-medium">Member</th>
              <th className="px-4 py-3 text-left font-medium">Role</th>
              <th className="px-4 py-3 text-left font-medium">Joined</th>
              {isAdmin && <th className="px-4 py-3 text-right font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            )}
            {members?.map((member) => (
              <tr key={member.id} className="border-b border-border/50">
                <td className="px-4 py-3">
                  <div>
                    <span className="font-medium">{member.name || member.email}</span>
                    {member.name && (
                      <span className="ml-2 text-xs text-muted-foreground">{member.email}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {isAdmin && member.role !== "OWNER" ? (
                    <select
                      value={member.role}
                      onChange={(e) =>
                        updateRoleMutation.mutate({
                          projectId,
                          userId: member.userId,
                          role: e.target.value as "OWNER" | "ADMIN" | "MEMBER" | "VIEWER",
                        })
                      }
                      className="rounded border border-border bg-card px-2 py-1 text-xs"
                    >
                      {role === "OWNER" && <option value="OWNER">Owner</option>}
                      <option value="ADMIN">Admin</option>
                      <option value="MEMBER">Member</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                  ) : (
                    <RoleBadge role={member.role} />
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(member.createdAt).toLocaleDateString()}
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 text-right">
                    {member.role !== "OWNER" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeMutation.mutate({ projectId, userId: member.userId })}
                      >
                        Remove
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {members && (
          <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
            {members.length} member{members.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Pending invitations */}
      {isAdmin && invitations && invitations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Pending Invitations</h3>
          <div className="rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-left font-medium">Invited by</th>
                  <th className="px-4 py-3 text-left font-medium">Expires</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => (
                  <tr key={inv.id} className="border-b border-border/50">
                    <td className="px-4 py-3">{inv.email}</td>
                    <td className="px-4 py-3">
                      <RoleBadge role={inv.role} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {inv.invitedBy.name || inv.invitedBy.email}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() =>
                          cancelInviteMutation.mutate({
                            projectId,
                            invitationId: inv.id,
                          })
                        }
                      >
                        Cancel
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// --- General Tab ---
function GeneralTab() {
  const projectId = useProjectStore((s) => s.projectId)!;
  const project = useProjectStore((s) => s.project);
  const role = useProjectStore((s) => s.role);
  const router = useRouter();
  const utils = trpc.useUtils();

  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");

  const updateMutation = trpc.projects.update.useMutation({
    onSuccess: () => {
      utils.projects.byId.invalidate({ projectId });
      utils.projects.list.invalidate();
    },
  });
  const deleteMutation = trpc.projects.delete.useMutation({
    onSuccess: () => router.push("/projects"),
  });

  const isAdmin = checkIsAdmin(role);
  const isOwner = role === "OWNER";

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h2 className="text-sm font-medium">Project Details</h2>
        <div className="space-y-3 max-w-md">
          <div>
            <label className="text-xs text-muted-foreground">Project name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!isAdmin}
              rows={3}
              className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm resize-none"
              placeholder="Optional project description"
            />
          </div>
          {isAdmin && (
            <Button
              size="sm"
              onClick={() => updateMutation.mutate({ projectId, name, description })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          )}
        </div>
      </div>

      {/* Danger zone */}
      {isOwner && (
        <div className="space-y-3 border-t border-border pt-6">
          <h2 className="text-sm font-medium text-destructive">Danger Zone</h2>
          <p className="text-xs text-muted-foreground">
            Deleting this project will permanently remove all traces, observations, API keys, and
            team memberships. This cannot be undone.
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm("Are you sure you want to delete this project? This cannot be undone.")) {
                deleteMutation.mutate({ projectId });
              }
            }}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete project"}
          </Button>
        </div>
      )}
    </div>
  );
}

// --- Main Settings Page ---
export default function SettingsPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl">
          <Tabs defaultValue="general">
            <TabsList variant="line" className="mb-6">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="api-keys">API Keys</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
            </TabsList>
            <TabsContent value="general">
              <GeneralTab />
            </TabsContent>
            <TabsContent value="api-keys">
              <ApiKeysTab />
            </TabsContent>
            <TabsContent value="members">
              <MembersTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
