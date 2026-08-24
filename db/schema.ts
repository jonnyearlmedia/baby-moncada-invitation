import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const households = sqliteTable("households", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tokenHash: text("token_hash").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const guests = sqliteTable("guests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  householdId: integer("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [uniqueIndex("guest_household_name_idx").on(table.householdId, table.displayName)]);

export const rsvpResponses = sqliteTable("rsvp_responses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  householdId: integer("household_id").notNull().references(() => households.id, { onDelete: "cascade" }).unique(),
  attendanceJson: text("attendance_json").notNull(),
  note: text("note").notNull().default(""),
  submittedAt: integer("submitted_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const householdsRelations = relations(households, ({ many, one }) => ({
  guests: many(guests),
  response: one(rsvpResponses),
}));

export const guestsRelations = relations(guests, ({ one }) => ({
  household: one(households, { fields: [guests.householdId], references: [households.id] }),
}));

export const rsvpRelations = relations(rsvpResponses, ({ one }) => ({
  household: one(households, { fields: [rsvpResponses.householdId], references: [households.id] }),
}));
