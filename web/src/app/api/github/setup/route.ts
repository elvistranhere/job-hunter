import { NextResponse } from "next/server";
// @ts-expect-error - tweetnacl-sealedbox-js has no type declarations
import sealedbox from "tweetnacl-sealedbox-js";

interface SetupRequest {
  token: string;
  profileJson: string;
  gmailUser: string;
  gmailAppPassword: string;
  emailTo: string;
}

async function githubApi(path: string, token: string, options: RequestInit = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  return res;
}

function encryptSecret(publicKey: string, secretValue: string): string {
  const keyBytes = Uint8Array.from(atob(publicKey), (c) => c.charCodeAt(0));
  const messageBytes = new TextEncoder().encode(secretValue);
  const encrypted = sealedbox.seal(messageBytes, keyBytes) as Uint8Array;
  return btoa(String.fromCharCode(...encrypted));
}

async function setRepoSecret(
  owner: string,
  repo: string,
  token: string,
  secretName: string,
  secretValue: string,
) {
  const keyRes = await githubApi(
    `/repos/${owner}/${repo}/actions/secrets/public-key`,
    token,
  );
  if (!keyRes.ok) throw new Error("Failed to get repo public key");

  const { key, key_id } = (await keyRes.json()) as {
    key: string;
    key_id: string;
  };

  const encryptedValue = await encryptSecret(key, secretValue);

  const res = await githubApi(
    `/repos/${owner}/${repo}/actions/secrets/${secretName}`,
    token,
    {
      method: "PUT",
      body: JSON.stringify({
        encrypted_value: encryptedValue,
        key_id,
      }),
    },
  );

  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to set secret ${secretName}`);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SetupRequest;

    if (
      !body.token ||
      !body.profileJson ||
      !body.gmailUser ||
      !body.gmailAppPassword ||
      !body.emailTo
    ) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    const forkRes = await githubApi("/repos/elvistranhere/job-hunter/forks", body.token, {
      method: "POST",
      body: JSON.stringify({}),
    });

    if (!forkRes.ok && forkRes.status !== 202) {
      const err = await forkRes.json().catch(() => ({}));
      if (forkRes.status !== 422) {
        return NextResponse.json(
          {
            error: `Failed to fork: ${(err as Record<string, string>).message ?? "unknown error"}`,
          },
          { status: 502 },
        );
      }
    }

    const userRes = await githubApi("/user", body.token);
    if (!userRes.ok) {
      return NextResponse.json({ error: "Failed to get user info" }, { status: 502 });
    }
    const user = (await userRes.json()) as { login: string };
    const owner = user.login;
    const repo = "job-hunter";

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const refRes = await githubApi(`/repos/${owner}/${repo}/git/ref/heads/main`, body.token);
    if (!refRes.ok) {
      return NextResponse.json(
        {
          error:
            "Failed to get fork ref. Fork may still be creating - try again in a moment.",
        },
        { status: 502 },
      );
    }
    const refData = (await refRes.json()) as { object: { sha: string } };
    const latestSha = refData.object.sha;

    const blobRes = await githubApi(`/repos/${owner}/${repo}/git/blobs`, body.token, {
      method: "POST",
      body: JSON.stringify({
        content: body.profileJson,
        encoding: "utf-8",
      }),
    });
    if (!blobRes.ok) {
      return NextResponse.json({ error: "Failed to create blob" }, { status: 502 });
    }
    const blob = (await blobRes.json()) as { sha: string };

    const commitRes = await githubApi(
      `/repos/${owner}/${repo}/git/commits/${latestSha}`,
      body.token,
    );
    if (!commitRes.ok) {
      return NextResponse.json({ error: "Failed to get commit" }, { status: 502 });
    }
    const commit = (await commitRes.json()) as { tree: { sha: string } };

    const treeRes = await githubApi(`/repos/${owner}/${repo}/git/trees`, body.token, {
      method: "POST",
      body: JSON.stringify({
        base_tree: commit.tree.sha,
        tree: [
          {
            path: "profile.json",
            mode: "100644",
            type: "blob",
            sha: blob.sha,
          },
        ],
      }),
    });
    if (!treeRes.ok) {
      return NextResponse.json({ error: "Failed to create tree" }, { status: 502 });
    }
    const tree = (await treeRes.json()) as { sha: string };

    const newCommitRes = await githubApi(`/repos/${owner}/${repo}/git/commits`, body.token, {
      method: "POST",
      body: JSON.stringify({
        message: "Add profile.json from Job Hunter web setup",
        tree: tree.sha,
        parents: [latestSha],
      }),
    });
    if (!newCommitRes.ok) {
      return NextResponse.json({ error: "Failed to create commit" }, { status: 502 });
    }
    const newCommit = (await newCommitRes.json()) as { sha: string };

    const updateRefRes = await githubApi(`/repos/${owner}/${repo}/git/refs/heads/main`, body.token, {
      method: "PATCH",
      body: JSON.stringify({ sha: newCommit.sha }),
    });
    if (!updateRefRes.ok) {
      return NextResponse.json({ error: "Failed to update ref" }, { status: 502 });
    }

    await setRepoSecret(owner, repo, body.token, "GMAIL_USER", body.gmailUser);
    await setRepoSecret(owner, repo, body.token, "GMAIL_APP_PASSWORD", body.gmailAppPassword);
    await setRepoSecret(owner, repo, body.token, "EMAIL_TO", body.emailTo);

    const workflowsRes = await githubApi(`/repos/${owner}/${repo}/actions/workflows`, body.token);
    if (workflowsRes.ok) {
      const workflows = (await workflowsRes.json()) as {
        workflows: { id: number; name: string; path: string }[];
      };
      const dailyWorkflow = workflows.workflows.find(
        (workflow) => workflow.path === ".github/workflows/daily-jobs.yml",
      );

      if (dailyWorkflow) {
        await githubApi(
          `/repos/${owner}/${repo}/actions/workflows/${dailyWorkflow.id}/enable`,
          body.token,
          { method: "PUT" },
        );

        await githubApi(
          `/repos/${owner}/${repo}/actions/workflows/${dailyWorkflow.id}/dispatches`,
          body.token,
          {
            method: "POST",
            body: JSON.stringify({ ref: "main" }),
          },
        );
      }
    }

    const fileRes = await githubApi(
      `/repos/${owner}/${repo}/contents/.github/workflows/daily-jobs.yml`,
      body.token,
    );
    if (fileRes.ok) {
      const fileData = (await fileRes.json()) as { content: string; sha: string };
      const content = atob(fileData.content.replace(/\n/g, ""));
      const updatedContent = content.replace(
        /  # schedule:\n  #   - cron: '0 21 \* \* \*'[^\n]*/,
        "  schedule:\n    - cron: '0 21 * * *'",
      );

      if (updatedContent !== content) {
        await githubApi(
          `/repos/${owner}/${repo}/contents/.github/workflows/daily-jobs.yml`,
          body.token,
          {
            method: "PUT",
            body: JSON.stringify({
              message: "Enable daily cron schedule",
              content: btoa(updatedContent),
              sha: fileData.sha,
            }),
          },
        );
      }
    }

    return NextResponse.json({
      success: true,
      repoUrl: `https://github.com/${owner}/${repo}`,
      actionsUrl: `https://github.com/${owner}/${repo}/actions`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Setup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
