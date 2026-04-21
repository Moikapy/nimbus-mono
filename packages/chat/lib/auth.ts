import { auth } from "@clerk/nextjs/server";

export const getAuthUserId = async (): Promise<string | null> => {
  const session = await auth();
  return session.userId;
};
