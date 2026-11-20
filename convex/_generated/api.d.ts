/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as alertTextSafety from "../alertTextSafety.js";
import type * as crmQuoteSync from "../crmQuoteSync.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as migrations from "../migrations.js";
import type * as notificationText from "../notificationText.js";
import type * as notifications from "../notifications.js";
import type * as platformTenancy from "../platformTenancy.js";
import type * as quoteAccess from "../quoteAccess.js";
import type * as quoteColorNames from "../quoteColorNames.js";
import type * as quoteDiscussions from "../quoteDiscussions.js";
import type * as quoteEmailNotifications from "../quoteEmailNotifications.js";
import type * as quotePricing from "../quotePricing.js";
import type * as quotePricingProvenance from "../quotePricingProvenance.js";
import type * as quoteRequests from "../quoteRequests.js";
import type * as quoteRetention from "../quoteRetention.js";
import type * as quoteSubmissionQuota from "../quoteSubmissionQuota.js";
import type * as reviewFeedback from "../reviewFeedback.js";
import type * as twilio from "../twilio.js";
import type * as validators from "../validators.js";
import type * as zohoMail from "../zohoMail.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  alertTextSafety: typeof alertTextSafety;
  crmQuoteSync: typeof crmQuoteSync;
  crons: typeof crons;
  http: typeof http;
  migrations: typeof migrations;
  notificationText: typeof notificationText;
  notifications: typeof notifications;
  platformTenancy: typeof platformTenancy;
  quoteAccess: typeof quoteAccess;
  quoteColorNames: typeof quoteColorNames;
  quoteDiscussions: typeof quoteDiscussions;
  quoteEmailNotifications: typeof quoteEmailNotifications;
  quotePricing: typeof quotePricing;
  quotePricingProvenance: typeof quotePricingProvenance;
  quoteRequests: typeof quoteRequests;
  quoteRetention: typeof quoteRetention;
  quoteSubmissionQuota: typeof quoteSubmissionQuota;
  reviewFeedback: typeof reviewFeedback;
  twilio: typeof twilio;
  validators: typeof validators;
  zohoMail: typeof zohoMail;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
};
