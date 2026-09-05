// The template bank registry (ASSESSMENT_DESIGN.md §4.1, §4.3). Aggregates
// all 52 template families (14 speed + 12 reasoning + 14 tech) plus the 12
// investigation scenarios, keyed by id, for generator.ts and bank-audit.ts.

import type { ItemTemplate, InvestigationScenario } from "../types";

import { template as speedJsonDiff } from "./speed/json_diff";
import { template as speedIpValid } from "./speed/ip_valid";
import { template as speedRegexMatch } from "./speed/regex_match";
import { template as speedTableLookup } from "./speed/table_lookup";
import { template as speedCountMatches } from "./speed/count_matches";
import { template as speedPathResolve } from "./speed/path_resolve";
import { template as speedBoolLogic } from "./speed/bool_logic";
import { template as speedSortedWhich } from "./speed/sorted_which";
import { template as speedOddOneOut } from "./speed/odd_one_out";
import { template as speedTimezoneShift } from "./speed/timezone_shift";
import { template as speedPercentChange } from "./speed/percent_change";
import { template as speedUnitsMath } from "./speed/units_math";
import { template as speedBracketBalance } from "./speed/bracket_balance";
import { template as speedDateDiff } from "./speed/date_diff";

import { template as reasoningRuleInduction } from "./reasoning/rule_induction";
import { template as reasoningSeqNumeric } from "./reasoning/seq_numeric";
import { template as reasoningGridPattern } from "./reasoning/grid_pattern";
import { template as reasoningConstraintsSeating } from "./reasoning/constraints_seating";
import { template as reasoningStateMachine } from "./reasoning/state_machine";
import { template as reasoningTableMustBeTrue } from "./reasoning/table_must_be_true";
import { template as reasoningOrderingClues } from "./reasoning/ordering_clues";
import { template as reasoningCipherRule } from "./reasoning/cipher_rule";
import { template as reasoningPseudocodeTrace } from "./reasoning/pseudocode_trace";
import { template as reasoningSetCounts } from "./reasoning/set_counts";
import { template as reasoningAnalogyStructural } from "./reasoning/analogy_structural";
import { template as reasoningMinMoves } from "./reasoning/min_moves";

import { template as techLogRootCause } from "./tech/log_root_cause";
import { template as techHttpStatusNext } from "./tech/http_status_next";
import { template as techMinimalAccess } from "./tech/minimal_access";
import { template as techSqlOutcome } from "./tech/sql_outcome";
import { template as techEnvDiffBug } from "./tech/env_diff_bug";
import { template as techWebhookVsPolling } from "./tech/webhook_vs_polling";
import { template as techSiteDownFirstCheck } from "./tech/site_down_first_check";
import { template as techAutomationPick } from "./tech/automation_pick";
import { template as techDataNormalize } from "./tech/data_normalize";
import { template as techCloudWaste } from "./tech/cloud_waste";
import { template as techSecuritySmell } from "./tech/security_smell";
import { template as techApiPaginationMath } from "./tech/api_pagination_math";
import { template as techGitWhatHappened } from "./tech/git_what_happened";
import { template as techFieldMappingError } from "./tech/field_mapping_error";

import { scenario as invWebhookMissing } from "./investigate/webhook_missing";
import { scenario as invSsoLoginSubset } from "./investigate/sso_login_subset";
import { scenario as invNightlyReportEmpty } from "./investigate/nightly_report_empty";
import { scenario as invCloudBillSpike } from "./investigate/cloud_bill_spike";
import { scenario as invExportPermission } from "./investigate/export_permission";
import { scenario as invSyncRateLimited } from "./investigate/sync_rate_limited";
import { scenario as invDuplicateSubmissions } from "./investigate/duplicate_submissions";
import { scenario as invEmailUndelivered } from "./investigate/email_undelivered";
import { scenario as invCertExpiredSubdomain } from "./investigate/cert_expired_subdomain";
import { scenario as invBackupSilentlyFailing } from "./investigate/backup_silently_failing";
import { scenario as invSaasSeatLimit } from "./investigate/saas_seat_limit";
import { scenario as invImportGarbledNames } from "./investigate/import_garbled_names";

export const SPEED_TEMPLATES: readonly ItemTemplate[] = [
  speedJsonDiff,
  speedIpValid,
  speedRegexMatch,
  speedTableLookup,
  speedCountMatches,
  speedPathResolve,
  speedBoolLogic,
  speedSortedWhich,
  speedOddOneOut,
  speedTimezoneShift,
  speedPercentChange,
  speedUnitsMath,
  speedBracketBalance,
  speedDateDiff,
];

export const REASONING_TEMPLATES: readonly ItemTemplate[] = [
  reasoningRuleInduction,
  reasoningSeqNumeric,
  reasoningGridPattern,
  reasoningConstraintsSeating,
  reasoningStateMachine,
  reasoningTableMustBeTrue,
  reasoningOrderingClues,
  reasoningCipherRule,
  reasoningPseudocodeTrace,
  reasoningSetCounts,
  reasoningAnalogyStructural,
  reasoningMinMoves,
];

export const TECH_TEMPLATES: readonly ItemTemplate[] = [
  techLogRootCause,
  techHttpStatusNext,
  techMinimalAccess,
  techSqlOutcome,
  techEnvDiffBug,
  techWebhookVsPolling,
  techSiteDownFirstCheck,
  techAutomationPick,
  techDataNormalize,
  techCloudWaste,
  techSecuritySmell,
  techApiPaginationMath,
  techGitWhatHappened,
  techFieldMappingError,
];

export const INVESTIGATION_SCENARIOS: readonly InvestigationScenario[] = [
  invWebhookMissing,
  invSsoLoginSubset,
  invNightlyReportEmpty,
  invCloudBillSpike,
  invExportPermission,
  invSyncRateLimited,
  invDuplicateSubmissions,
  invEmailUndelivered,
  invCertExpiredSubdomain,
  invBackupSilentlyFailing,
  invSaasSeatLimit,
  invImportGarbledNames,
];

export const ALL_CHOICE_TEMPLATES: readonly ItemTemplate[] = [
  ...SPEED_TEMPLATES,
  ...REASONING_TEMPLATES,
  ...TECH_TEMPLATES,
];

/** Which cause variants of a scenario require escalation-with-proposal as the correct q2 answer. */
export const ESCALATION_CAUSES: ReadonlyMap<string, readonly ("a" | "b" | "c")[]> = new Map(
  INVESTIGATION_SCENARIOS.map((s) => [s.id, s.escalationCauses]),
);
