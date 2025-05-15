import { relations, sql } from "drizzle-orm"
import {
    boolean,
    index,
    integer,
    jsonb,
    pgEnum,
    pgSchema,
    pgTable,
    primaryKey,
    real,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core"

// This file contains the schema for the database.
// PostgreSQL supports more data types than SQLite, including timestamps, booleans, and enums.

// Define proper PostgreSQL enums
export const userRoleEnum = pgEnum("user_role", ["basic", "premium", "admin"])
export const stateEnum = pgEnum("card_state", [
    "New",
    "Learning",
    "Review",
    "Relearning",
])
export const ratingEnum = pgEnum("card_rating", [
    "Manual",
    "Again",
    "Hard",
    "Good",
    "Easy",
])

// TypeScript types for type safety
export type UserRole = (typeof userRoleEnum.enumValues)[number]
export type State = (typeof stateEnum.enumValues)[number]
export type Rating = (typeof ratingEnum.enumValues)[number]

const authSchema = pgSchema("auth")

const authUsers = authSchema.table("users", {
    id: uuid("id").primaryKey(),
})

export const users = pgTable("profiles", {
    id: uuid("id")
        .primaryKey()
        .references(() => authUsers.id),
    username: text("username"),
    role: userRoleEnum("role").notNull().default("basic"),
    welcomeOnboarded: boolean("welcome_onboarded").notNull().default(false),
    readerOnboarded: boolean("reader_onboarded").notNull().default(false),
    recallOnboarded: boolean("recall_onboarded").notNull().default(false),
})

export type NewUser = typeof users.$inferInsert
export type User = Omit<typeof users.$inferSelect, "emailVerified">

export const userMedia = pgTable(
    "user_media",
    {
        id: uuid("id").primaryKey(),
        userId: uuid("userId")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        url: text("url").notNull(),
        createdAt: timestamp("created_at")
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`),
    },
    (table) => ({
        userMediaUserIdIndx: index("user_media_user_id_indx").on(table.userId),
        userMediaUserIdCreatedAtIndx: index(
            "user_media_user_id_created_at_indx"
        ).on(table.userId, table.createdAt),
    })
)

export type NewUserMedia = typeof userMedia.$inferInsert
export type UserMedia = typeof userMedia.$inferSelect

export const userMediaRelations = relations(userMedia, ({ one }) => ({
    user: one(users, {
        fields: [userMedia.userId],
        references: [users.id],
    }),
}))

// See https://open-spaced-repetition.github.io/ts-fsrs/

export const reviewLogs = pgTable(
    "review_logs",
    {
        id: uuid("id").primaryKey(),
        cardId: uuid("card_id")
            .notNull()
            .references(() => cards.id, { onDelete: "cascade" }),
        grade: ratingEnum("grade").notNull(),
        state: stateEnum("state").notNull(),

        due: timestamp("due").notNull(),
        stability: real("stability").notNull(),
        difficulty: real("difficulty").notNull(),
        elapsed_days: integer("elapsed_days").notNull(),
        last_elapsed_days: integer("last_elapsed_days").notNull(),
        scheduled_days: integer("scheduled_days").notNull(),
        review: timestamp("review").notNull(),
        duration: integer("duration").notNull().default(0),
        deleted: boolean("deleted").notNull().default(false),

        createdAt: timestamp("created_at")
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`),
    },
    (table) => {
        return {
            reviewLogsCardIdIndx: index("review_logs_card_id_indx").on(
                table.cardId
            ),
            reviewLogsCreatedAtIndx: index("review_logs_created_at_indx").on(
                table.createdAt
            ),
        }
    }
)

export type ReviewLog = typeof reviewLogs.$inferSelect
export type NewReviewLog = typeof reviewLogs.$inferInsert

// * For now we just copy the schema from the ts-fsrs-demo example
// Note that some fields use snake case here for compatiblity with the ts-fsrs library
// TODO standardise to using camelCase and write a converter
export const cards = pgTable(
    "cards",
    {
        id: uuid("id").primaryKey(),
        due: timestamp("due")
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`), // https://orm.drizzle.team/learn/guides/timestamp-default-value
        stability: real("stability").notNull(),
        difficulty: real("difficulty").notNull(),
        elapsed_days: integer("elapsed_days").notNull(),
        scheduled_days: integer("scheduled_days").notNull(),
        reps: integer("reps").notNull(),
        lapses: integer("lapses").notNull(),
        state: stateEnum("state").notNull(),
        last_review: timestamp("last_review"),

        // The time the card is suspended until
        suspended: timestamp("suspended")
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`),

        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),

        // revlogs logs
        deleted: boolean("deleted").notNull().default(false),

        createdAt: timestamp("created_at")
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`),
    },
    (table) => {
        return {
            cardsUserIdIndx: index("cards_user_id_indx").on(table.userId),
            // cards are sorted by user ID first, then the others
            cardsUserIdCreatedAtIndx: index("cards_user_id_created_at_indx").on(
                table.userId,
                table.createdAt
            ),
            cardsUserIdDifficultyIndx: index(
                "cards_user_id_difficulty_indx"
            ).on(table.userId, table.difficulty),
        }
    }
)
// Benchmark performance to check if we should use indexes for difficulty and due
// columns.

export type Card = typeof cards.$inferSelect
export type NewCard = typeof cards.$inferInsert

// TODO rename to camelCase
export const cardContents = pgTable(
    "card_contents",
    {
        id: uuid("id").primaryKey(),
        // card
        cardId: uuid("card_id")
            .notNull()
            .references(() => cards.id, { onDelete: "cascade" }),

        question: text("question").notNull().default(""),
        answer: text("answer").notNull().default(""),
        source: text("source").notNull().default(""),
        sourceId: text("sourceId"),
        extend: jsonb("extend"),
        deleted: boolean("deleted").notNull().default(false),
        createdAt: timestamp("created_at")
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`),
    },
    (table) => {
        return {
            cardContentscardIdIndx: uniqueIndex(
                "card_contents_card_id_indx"
            ).on(table.cardId),
        }
    }
)

export type CardContent = typeof cardContents.$inferSelect
export type NewCardContent = typeof cardContents.$inferInsert

export const decks = pgTable(
    "decks",
    {
        id: uuid("id").primaryKey(),
        name: text("name").notNull(),
        description: text("description").notNull().default(""),
        deleted: boolean("deleted").notNull().default(false),
        createdAt: timestamp("created_at")
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
    },
    (table) => {
        return {
            decksUserIdIndx: index("decks_user_id_indx").on(table.userId),
        }
    }
)

export type Deck = typeof decks.$inferSelect
export type NewDeck = typeof decks.$inferInsert

// https://orm.drizzle.team/docs/rqb#many-to-many
// TODO: check behaviour of deletes on this many-to-many table
export const cardsToDecks = pgTable(
    "cards_to_decks",
    {
        cardId: uuid("card_id")
            .notNull()
            .references(() => cards.id, { onDelete: "cascade" }),
        deckId: uuid("deck_id")
            .notNull()
            .references(() => decks.id, {
                onDelete: "cascade",
            }),
        createdAt: timestamp("created_at")
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`),
    },
    (t) => ({
        pk: primaryKey({ columns: [t.cardId, t.deckId] }),
    })
)

export type CardsToDecks = typeof cardsToDecks.$inferSelect
export type NewCardsToDecks = typeof cardsToDecks.$inferInsert

export const reviewLogsRelations = relations(reviewLogs, ({ one }) => ({
    card: one(cards, {
        fields: [reviewLogs.cardId],
        references: [cards.id],
    }),
}))

export const cardsRelations = relations(cards, ({ one, many }) => ({
    reviewLogs: many(reviewLogs),
    cardsToDecks: many(cardsToDecks),
    users: one(users, {
        fields: [cards.userId],
        references: [users.id],
    }),
}))

export const cardContentsRelations = relations(cardContents, ({ one }) => ({
    card: one(cards, {
        fields: [cardContents.cardId],
        references: [cards.id],
    }),
}))

export const decksRelations = relations(decks, ({ one, many }) => ({
    cardsToDecks: many(cardsToDecks),
    users: one(users, {
        fields: [decks.userId],
        references: [users.id],
    }),
}))

export const cardsToDecksRelations = relations(cardsToDecks, ({ one }) => ({
    card: one(cards, {
        fields: [cardsToDecks.cardId],
        references: [cards.id],
    }),
    deck: one(decks, {
        fields: [cardsToDecks.deckId],
        references: [decks.id],
    }),
}))
