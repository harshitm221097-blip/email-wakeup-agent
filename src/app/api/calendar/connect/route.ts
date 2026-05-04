import { NextResponse } from "next/server";
import { getGoogleAuth, GOOGLE_SCOPES } from "@/lib/google-calendar";

export async function GET() {
  try {
    const oauth2Client = getGoogleAuth();

    const state = crypto.randomUUID();

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: GOOGLE_SCOPES,
      state,
      prompt: "consent",
    });

    const response = NextResponse.redirect(authUrl);

    // Store state in a cookie for CSRF protection
    response.cookies.set("google_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Failed to initiate Google OAuth:", error);
    return NextResponse.json(
      { error: "Failed to initiate Google OAuth" },
      { status: 500 }
    );
  }
}
