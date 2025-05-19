import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (token) {
    const cookieStore = cookies();
    cookieStore.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60, // 1 giờ
      path: "/",
    });
    return NextResponse.redirect(new URL("/user/login", request.url));
  }

  return NextResponse.json({ error: "Không có token" }, { status: 400 });
}