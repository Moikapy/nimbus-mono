import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtected = createRouteMatcher(["/"]); // Require auth for chat
const isPublicApi = createRouteMatcher(["/api/chat", "/api/stripe/webhook", "/api/billing(.*)"]);

export default clerkMiddleware(async (_auth, req) => {
  // Stripe webhooks must be public
  if (isPublicApi(req)) return;

  if (isProtected(req)) {
    // Protect main route if desired
    // auth().protect(); // Uncomment to require login
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
