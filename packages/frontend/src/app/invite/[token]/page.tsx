"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { status } = useSession();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  const acceptMutation = trpc.members.acceptInvitation.useMutation({
    onSuccess: (data) => {
      router.push(`/project/${data.projectId}/traces`);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`);
    }
  }, [status, router, token]);

  useEffect(() => {
    if (status === "authenticated" && !attempted.current) {
      attempted.current = true;
      acceptMutation.mutate({ token });
    }
  }, [status, token, acceptMutation]);

  if (status === "loading" || acceptMutation.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Accepting invitation...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="secondary" onClick={() => router.push("/projects")}>
            Go to projects
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
