// The template bank registry (ASSESSMENT_DESIGN.md §4.1, §4.3). Aggregates
// all 47 template families (12 speed + 11 reasoning + 12 tech + 12 knowledge)
// plus the 12 investigation scenarios, keyed by id, for generator.ts and
// bank-audit.ts.
//
// Round 3 (ASSESSMENT_DESIGN.md §2.2): seven families were retired because
// they measured prior coursework or vocabulary rather than the target
// (smart / independent / technology instinct) — speed.ip_valid,
// speed.regex_match (both were tagged `fluency: true`), speed.odd_one_out,
// speed.date_diff, reasoning.analogy_structural, tech.git_what_happened,
// tech.data_normalize. Two families were added in their place
// (speed.smell_the_number, speed.log_gap), chosen to be fast for a person who
// has the instinct and slow for anyone routing the item through a phone LLM.

import type { ItemTemplate, InvestigationScenario } from "../types";

import { template as speedJsonDiff } from "./speed/json_diff";
import { template as speedTableLookup } from "./speed/table_lookup";
import { template as speedCountMatches } from "./speed/count_matches";
import { template as speedPathResolve } from "./speed/path_resolve";
import { template as speedBoolLogic } from "./speed/bool_logic";
import { template as speedSortedWhich } from "./speed/sorted_which";
import { template as speedTimezoneShift } from "./speed/timezone_shift";
import { template as speedPercentChange } from "./speed/percent_change";
import { template as speedUnitsMath } from "./speed/units_math";
import { template as speedBracketBalance } from "./speed/bracket_balance";
import { template as speedSmellTheNumber } from "./speed/smell_the_number";
import { template as speedLogGap } from "./speed/log_gap";

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
import { template as reasoningMinMoves } from "./reasoning/min_moves";

import { template as techLogRootCause } from "./tech/log_root_cause";
import { template as techHttpStatusNext } from "./tech/http_status_next";
import { template as techMinimalAccess } from "./tech/minimal_access";
import { template as techSqlOutcome } from "./tech/sql_outcome";
import { template as techEnvDiffBug } from "./tech/env_diff_bug";
import { template as techWebhookVsPolling } from "./tech/webhook_vs_polling";
import { template as techSiteDownFirstCheck } from "./tech/site_down_first_check";
import { template as techAutomationPick } from "./tech/automation_pick";
import { template as techCloudWaste } from "./tech/cloud_waste";
import { template as techSecuritySmell } from "./tech/security_smell";
import { template as techApiPaginationMath } from "./tech/api_pagination_math";
import { template as techFieldMappingError } from "./tech/field_mapping_error";

import { template as knowledgeWhatIs } from "./knowledge/what_is";
import { template as knowledgeHttpStatus } from "./knowledge/http_status";
import { template as knowledgeFileType } from "./knowledge/file_type";
import { template as knowledgeToolPurpose } from "./knowledge/tool_purpose";
import { template as knowledgeCommandPurpose } from "./knowledge/command_purpose";
import { template as knowledgeUrlParts } from "./knowledge/url_parts";
import { template as knowledgeIpValid } from "./knowledge/ip_valid";
import { template as knowledgeFormatValid } from "./knowledge/format_valid";
import { template as knowledgeJsonValid } from "./knowledge/json_valid";
import { template as knowledgeUnitsBigger } from "./knowledge/units_bigger";
import { template as knowledgeOddOneOut } from "./knowledge/odd_one_out";
import { template as knowledgeSpotSyntaxError } from "./knowledge/spot_syntax_error";

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
  speedTableLookup,
  speedCountMatches,
  speedPathResolve,
  speedBoolLogic,
  speedSortedWhich,
  speedTimezoneShift,
  speedPercentChange,
  speedUnitsMath,
  speedBracketBalance,
  speedSmellTheNumber,
  speedLogGap,
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
  techCloudWaste,
  techSecuritySmell,
  techApiPaginationMath,
  techFieldMappingError,
];

/**
 * The knowledge block (blueprint v3). These score into the `tech` pillar — the
 * hiring manager gets one technology number rather than two — but they are a
 * separate pool so the tech block never serves them and vice versa
 * (generator.ts `poolForBlock`).
 */
export const KNOWLEDGE_TEMPLATES: readonly ItemTemplate[] = [
  knowledgeWhatIs,
  knowledgeHttpStatus,
  knowledgeFileType,
  knowledgeToolPurpose,
  knowledgeCommandPurpose,
  knowledgeUrlParts,
  knowledgeIpValid,
  knowledgeFormatValid,
  knowledgeJsonValid,
  knowledgeUnitsBigger,
  knowledgeOddOneOut,
  knowledgeSpotSyntaxError,
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
  ...KNOWLEDGE_TEMPLATES,
];

/** Which cause variants of a scenario require escalation-with-proposal as the correct q2 answer. */
export const ESCALATION_CAUSES: ReadonlyMap<string, readonly ("a" | "b" | "c")[]> = new Map(
  INVESTIGATION_SCENARIOS.map((s) => [s.id, s.escalationCauses]),
);
