import { NextResponse } from "next/server";
import { getGoogleAuth } from "@/lib/google-calendar";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code) {
      return NextResponse.json(
        { error: "Missing authorization code" },
        { status: 400 }
      );
    }

    // Validate CSRF state
    const cookieStore = request.headers.get("cookie") ?? "";
    const stateCookie = cookieStore
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("google_oauth_state="))
      ?.split("=")[1];

    if (!state || state !== stateCookie) {
      return NextResponse.json(
        { error: "Invalid OAuth state. Possible CSRF attack." },
        { status: 403 }
      );
    }

    const oauth2Client = getGoogleAuth();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.json(
        { error: "Failed to obtain tokens from Google" },
        { status: 400 }
      );
    }

    // Store tokens in AgentConfig table
    await prisma.agentConfig.upsert({
      where: { key: "google_access_token" },
      update: { value: tokens.access_token },
      create: { key: "google_access_token", value: tokens.access_token },
    });

    await prisma.agentConfig.upsert({
      where: { key: "google_refresh_token" },
      update: { value: tokens.refresh_token },
      create: { key: "google_refresh_token", value: tokens.refresh_token },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const response = NextResponse.redirect(
      `${baseUrl}/settings?calendar=connected`
    );

    // Clear the state cookie
    response.cookies.set("google_oauth_state", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Failed to handle Google OAuth callback:", error);
    return NextResponse.json(
      { error: "Failed to complete Google OAuth" },
      { status: 500 }
    );
  }
}
