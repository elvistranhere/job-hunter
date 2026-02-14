import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = (await req.json()) as { device_code?: string };

  if (!body.device_code) {
    return NextResponse.json(
      { error: "device_code is required" },
      { status: 400 },
    );
  }

  const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "GitHub OAuth not configured" },
      { status: 500 },
    );
  }

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: clientId,
      device_code: body.device_code,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to poll token" }, { status: 502 });
  }

  const data = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
    interval?: number;
  };

  if (data.access_token) {
    return NextResponse.json({ access_token: data.access_token });
  }

  return NextResponse.json({
    error: data.error ?? "authorization_pending",
    interval: data.interval,
  });
}
