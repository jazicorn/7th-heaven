export const prerender = false;

import { db, eq, isDbError, Users, Newsletter } from "astro:db";
import { z } from "zod";

// Define the schema for user input
const userSchema = z.object({
  first_name: z.string().optional().transform((val) => val?.trim().substring(0, 50) || ""),
  last_name: z.string().optional().transform((val) => val?.trim().substring(0, 50) || ""),
  email: z.string().email().transform((val) => val.trim()),
});

// Define the schema for newsletter preferences with default values
const newsletterSchema = z.object({
  heaven: z.boolean().optional().default(false),
  announcements: z.boolean().optional().default(false),
  community: z.boolean().optional().default(false),
  author: z.boolean().optional().default(false),
  events: z.boolean().optional().default(false),
  releases: z.boolean().optional().default(false),
});

// Export inferred types if needed elsewhere
export type UserData = z.infer<typeof userSchema>;
export type NewsletterPreferences = z.infer<typeof newsletterSchema>;

export interface SubscriptionResult {
  success: boolean;
}

/**
 * Subscribes a user to the newsletter securely.
 *
 * This function validates and transforms the input using Zod before performing a batch insert
 * into the Users and Newsletter tables. If validation fails or the database operation encounters an issue,
 * an error is thrown.
 *
 * @param user - An object containing first_name, last_name, and email.
 * @param newsletter - An object containing newsletter preferences.
 * @returns A promise that resolves with the subscription result.
 */
export async function dbNewsletterSubscribe(
  user: userSchema,
  newsletter: newsletterSchema
): Promise<SubscriptionResult> {
  // Validate and sanitize input using Zod schemas
  const parsedUser = userSchema.parse(user);
  const parsedNewsletter = newsletterSchema.parse(newsletter);

  try {
    // Use a transaction for atomic operations
    await db.transaction(async (tx) => {
      // Insert the user and retrieve the generated ID
      const userResult = await tx.insert(Users).values({
        user_first_name: parsedUser.first_name,
        user_last_name: parsedUser.last_name,
        user_email: parsedUser.email,
        user_created_at: new Date(),
        user_updated_at: new Date(),
        user_flagged: false,
      });

      const [user] = await tx
        .select({ id: Users.id })
        .from(Users)
        .where(eq(Users.user_email, parsedUser.email));

      // Now insert the newsletter subscription with the proper user id
      await tx.insert(Newsletter).values({
        user_id: user.id,
        news_email: parsedUser.email,
        news_heaven: parsedNewsletter.heaven,
        news_announcements: parsedNewsletter.announcements,
        news_community: parsedNewsletter.community,
        news_events: parsedNewsletter.events,
        news_author: parsedNewsletter.author,
        news_releases: parsedNewsletter.releases,
        news_active: true,
      });
    });
    return { success: true };
  } catch (error) {
    if (isDbError(error)) {
      console.error("Database error:", error.message);
    } else {
      console.error("Database error:", error);
    }

    throw new Error("DB Error. Please try again.");
  }
}