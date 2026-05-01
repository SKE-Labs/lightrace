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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserPlus } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { RoleBadge, isAdmin as checkIsAdmin } from "@/lib/role-config";
import { cn, SECTION_LABEL } from "@/lib/utils";

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-input/20 dark:bg-input/30 px-3 text-[13px] text-foreground transition-colors duration-150 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium">API Keys</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Use these keys with the Lightrace SDK to send traces.
          </p>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button size="sm" />} onClick={() => setNewKeyResult(null)}>
              Create key
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{newKeyResult ? "API key created" : "Create API key"}</DialogTitle>
              </DialogHeader>
              {!newKeyResult ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className={SECTION_LABEL}>Note (optional)</label>
                    <Input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="e.g. Development"
                      className="h-9 text-[13px]"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handleCreate} disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Creating…" : "Create"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-warning">
                    Save these keys now. The secret key will not be shown again.
                  </p>
                  <KeyReveal label="Public key" value={newKeyResult.publicKey} />
                  <KeyReveal label="Secret key" value={newKeyResult.secretKey} />
                  <div className="space-y-1.5">
                    <label className={SECTION_LABEL}>SDK usage</label>
                    <pre className="rounded-md bg-muted/60 ring-1 ring-foreground/10 p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                      {`from lightrace import Lightrace

lt = Lightrace(
    public_key="${newKeyResult.publicKey}",
    secret_key="${newKeyResult.secretKey}",
    host="http://localhost:3000"
)`}
                    </pre>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                      Done
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <Table density="tight">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Public key</TableHead>
              <TableHead>Secret key</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Created</TableHead>
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={isAdmin ? 5 : 4}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {apiKeys?.map((key) => (
              <TableRow key={key.id} className="hover:bg-foreground/[0.03]">
                <TableCell className="font-mono text-xs">{key.publicKey}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {key.displaySecretKey}
                </TableCell>
                <TableCell>{key.note || "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(key.createdAt).toLocaleDateString()}
                </TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => deleteMutation.mutate({ projectId, id: key.id })}
                    >
                      Delete
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {apiKeys?.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={isAdmin ? 5 : 4}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No API keys. Create one to start sending traces.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function KeyReveal({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <label className={SECTION_LABEL}>{label}</label>
      <div className="flex items-center gap-2 rounded-md bg-muted/60 ring-1 ring-foreground/10 px-3 py-2">
        <code className="text-xs font-mono break-all flex-1">{value}</code>
        <CopyButton text={value} />
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium">Team members</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Manage who has access to this project.
          </p>
        </div>
        {isAdmin && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
              <UserPlus className="size-3.5" strokeWidth={1.5} />
              Invite members
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Invite team members</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className={SECTION_LABEL}>Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "ADMIN" | "MEMBER" | "VIEWER")}
                    className={SELECT_CLASS}
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="MEMBER">Member</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={SECTION_LABEL}>Email address</label>
                  <Input
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="name@example.com"
                    type="email"
                    className="h-9 text-[13px]"
                  />
                </div>
                {inviteMutation.error && (
                  <p className="text-xs text-error">{inviteMutation.error.message}</p>
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
                    {inviteMutation.isPending ? "Sending…" : "Send invitation"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Members table */}
      <div className="rounded-md border border-border overflow-hidden">
        <Table density="tight">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={isAdmin ? 4 : 3}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {members?.map((member) => (
              <TableRow key={member.id} className="hover:bg-foreground/[0.03]">
                <TableCell>
                  <div>
                    <span className="font-medium text-foreground">
                      {member.name || member.email}
                    </span>
                    {member.name && (
                      <span className="ml-2 text-xs text-muted-foreground">{member.email}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
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
                      className={cn(SELECT_CLASS, "h-7 text-xs w-auto px-2")}
                    >
                      {role === "OWNER" && <option value="OWNER">Owner</option>}
                      <option value="ADMIN">Admin</option>
                      <option value="MEMBER">Member</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                  ) : (
                    <RoleBadge role={member.role} />
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(member.createdAt).toLocaleDateString()}
                </TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    {member.role !== "OWNER" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => removeMutation.mutate({ projectId, userId: member.userId })}
                      >
                        Remove
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {members && (
          <div className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border">
            {members.length} member{members.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Pending invitations */}
      {isAdmin && invitations && invitations.length > 0 && (
        <div className="space-y-3">
          <h3 className={SECTION_LABEL}>Pending invitations</h3>
          <div className="rounded-md border border-border overflow-hidden">
            <Table density="tight">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Invited by</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => (
                  <TableRow key={inv.id} className="hover:bg-foreground/[0.03]">
                    <TableCell>{inv.email}</TableCell>
                    <TableCell>
                      <RoleBadge role={inv.role} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {inv.invitedBy.name || inv.invitedBy.email}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() =>
                          cancelInviteMutation.mutate({
                            projectId,
                            invitationId: inv.id,
                          })
                        }
                      >
                        Cancel
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
        <div>
          <h2 className="text-sm font-medium">Project details</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Update the name and description shown across the dashboard.
          </p>
        </div>
        <div className="space-y-3 max-w-md">
          <div className="space-y-1.5">
            <label className={SECTION_LABEL}>Project name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isAdmin}
              className="h-9 text-[13px]"
            />
          </div>
          <div className="space-y-1.5">
            <label className={SECTION_LABEL}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!isAdmin}
              rows={3}
              className="w-full rounded-md border border-input bg-input/20 dark:bg-input/30 px-3 py-2 text-[13px] text-foreground transition-colors duration-150 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Optional project description"
            />
          </div>
          {isAdmin && (
            <Button
              size="sm"
              onClick={() => updateMutation.mutate({ projectId, name, description })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          )}
        </div>
      </div>

      {/* Danger zone */}
      {isOwner && (
        <div className="rounded-md border border-error/30 bg-error/5 p-4 space-y-3">
          <div>
            <h2 className="text-sm font-medium text-error">Danger zone</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Deleting this project permanently removes all traces, observations, API keys, and team
              memberships. This cannot be undone.
            </p>
          </div>
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
            {deleteMutation.isPending ? "Deleting…" : "Delete project"}
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
