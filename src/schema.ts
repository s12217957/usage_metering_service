import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  boolean,
  unique,
  date,
  primaryKey,
} from "drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  apiKeyHash: varchar("api_key_hash", { length: 64 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});



export const plans = pgTable("plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  scope: varchar("scope", { length: 20 }).notNull(),
  monthlyLimit: integer("monthly_limit").notNull(),
  maxUnitsPerRequest: integer("max_units_per_request").notNull(),
  ownerAccountId: uuid("owner_account_id").references(() => accounts.id),
  isPredefined: boolean("is_predefined").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  externalId: varchar("external_id", { length: 200 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("users_account_external_id_unique").on(
      table.accountId,
      table.externalId,
    ),
  ],
);


export const accountPlanAssignments = pgTable(
  "account_plan_assignments",
  {
    accountId: uuid("account_id")
      .primaryKey()
      .references(() => accounts.id),

    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id),
  },
);


export const userPlanAssignments = pgTable("user_plan_assignments", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id),

  planId: uuid("plan_id")
    .notNull()
    .references(() => plans.id),
});


export const accountMonthlyUsage = pgTable(
  "account_monthly_usage",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),


    periodStart: date("period_start", { mode: "string" }).notNull(),

    consumedUnits: integer("consumed_units").default(0).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.accountId, table.periodStart] }),
  ],
);


export const userMonthlyUsage = pgTable(
  "user_monthly_usage",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    consumedUnits: integer("consumed_units").default(0).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.periodStart] }),
  ],
);



export const consumptionRequests = pgTable(
  "consumption_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),


    requestId: varchar("request_id", { length: 200 }).notNull(),

    units: integer("units").notNull(),

    decision: varchar("decision", { length: 20 }).notNull(),


    rejectionLevel: varchar("rejection_level", { length: 20 }),
    rejectionReason: varchar("rejection_reason", { length: 500 }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("consumption_requests_account_request_id_unique").on(
      table.accountId,
      table.requestId,
    ),
  ],
);