/**
 * Home inspector licensing status by state.
 *
 * Sources: state real estate / professional licensing boards, ASHI/InterNACHI
 * regulatory tracker, current as of 2026-04-30. "no_license" means no STATE
 * license is required to perform paid home inspections — local registration
 * may still apply.
 */

export type StateStatus = "no_license" | "license_required" | "approved";

export interface StateInfo {
  code: string;
  name: string;
  status: StateStatus;
  notes: string;
  waitlist?: boolean;
}

export const HOME_INSPECTOR_STATES: StateInfo[] = [
  {
    code: "AL",
    name: "Alabama",
    status: "license_required",
    notes:
      "Alabama requires a state home inspector license through the Alabama Building Commission. We're working on Alabama approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "AK",
    name: "Alaska",
    status: "no_license",
    notes:
      "No state license required. Our course qualifies you for InterNACHI certification.",
  },
  {
    code: "AZ",
    name: "Arizona",
    status: "no_license",
    notes:
      "No state license required. Our course qualifies you for InterNACHI certification.",
  },
  {
    code: "AR",
    name: "Arkansas",
    status: "license_required",
    notes:
      "Arkansas requires a state license through the Home Inspector Registration Board. We're working on Arkansas approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "CA",
    name: "California",
    status: "license_required",
    notes:
      "Home inspectors in California need a state license. We're working on California approval — join our waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "CO",
    name: "Colorado",
    status: "no_license",
    notes:
      "No state license required. Our course qualifies you for InterNACHI certification.",
  },
  {
    code: "CT",
    name: "Connecticut",
    status: "license_required",
    notes:
      "Home inspectors in Connecticut need a state license through the Department of Consumer Protection. We're working on Connecticut approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "DE",
    name: "Delaware",
    status: "license_required",
    notes:
      "Home inspectors in Delaware need a state license. We're working on Delaware approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "DC",
    name: "District of Columbia",
    status: "no_license",
    notes:
      "No DC license required. Our course qualifies you for InterNACHI certification.",
  },
  {
    code: "FL",
    name: "Florida",
    status: "license_required",
    notes:
      "Home inspectors in Florida need a state license through the DBPR. We're working on Florida approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "GA",
    name: "Georgia",
    status: "no_license",
    notes:
      "No state license required. Our course qualifies you for InterNACHI certification.",
  },
  {
    code: "HI",
    name: "Hawaii",
    status: "license_required",
    notes:
      "Home inspectors in Hawaii need a state license. We're working on Hawaii approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "ID",
    name: "Idaho",
    status: "no_license",
    notes:
      "No state license required. Our course qualifies you for InterNACHI certification.",
  },
  {
    code: "IL",
    name: "Illinois",
    status: "license_required",
    notes:
      "Home inspectors in Illinois need a state license through IDFPR. We're working on Illinois approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "IN",
    name: "Indiana",
    status: "license_required",
    notes:
      "Home inspectors in Indiana need a state license. We're working on Indiana approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "IA",
    name: "Iowa",
    status: "no_license",
    notes:
      "No state license required. Our course qualifies you for InterNACHI certification.",
  },
  {
    code: "KS",
    name: "Kansas",
    status: "no_license",
    notes:
      "No state license required. Our course qualifies you for InterNACHI certification.",
  },
  {
    code: "KY",
    name: "Kentucky",
    status: "license_required",
    notes:
      "Home inspectors in Kentucky need a state license. We're working on Kentucky approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "LA",
    name: "Louisiana",
    status: "license_required",
    notes:
      "Home inspectors in Louisiana need a state license through LSBHI. We're working on Louisiana approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "ME",
    name: "Maine",
    status: "license_required",
    notes:
      "Home inspectors in Maine need a state license. We're working on Maine approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "MD",
    name: "Maryland",
    status: "license_required",
    notes:
      "Home inspectors in Maryland need a state license through the Real Estate Commission. We're working on Maryland approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "MA",
    name: "Massachusetts",
    status: "no_license",
    notes:
      "No state license required. Our course qualifies you for InterNACHI certification.",
  },
  {
    code: "MI",
    name: "Michigan",
    status: "no_license",
    notes:
      "No state license required. Our course qualifies you for InterNACHI certification.",
  },
  {
    code: "MN",
    name: "Minnesota",
    status: "license_required",
    notes:
      "Home inspectors in Minnesota need a state license. We're working on Minnesota approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "MS",
    name: "Mississippi",
    status: "no_license",
    notes:
      "No state license required. Our course qualifies you for InterNACHI certification.",
  },
  {
    code: "MO",
    name: "Missouri",
    status: "no_license",
    notes:
      "No state license required. Our course qualifies you for InterNACHI certification.",
  },
  {
    code: "MT",
    name: "Montana",
    status: "no_license",
    notes:
      "No state license required. Our course qualifies you for InterNACHI certification.",
  },
  {
    code: "NE",
    name: "Nebraska",
    status: "no_license",
    notes:
      "No state license required. Our course qualifies you for InterNACHI certification.",
  },
  {
    code: "NV",
    name: "Nevada",
    status: "license_required",
    notes:
      "Home inspectors in Nevada need a state license through the Real Estate Division. We're working on Nevada approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "NH",
    name: "New Hampshire",
    status: "license_required",
    notes:
      "Home inspectors in New Hampshire need a state license. We're working on New Hampshire approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "NJ",
    name: "New Jersey",
    status: "license_required",
    notes:
      "Home inspectors in New Jersey need a state license through the Home Inspection Advisory Committee. We're working on New Jersey approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "NM",
    name: "New Mexico",
    status: "license_required",
    notes:
      "Home inspectors in New Mexico need a state license. We're working on New Mexico approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "NY",
    name: "New York",
    status: "license_required",
    notes:
      "Home inspectors in New York need a state license through the Department of State. We're working on New York approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "NC",
    name: "North Carolina",
    status: "license_required",
    notes:
      "Home inspectors in North Carolina need a state license through the Home Inspector Licensure Board. We're working on North Carolina approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "ND",
    name: "North Dakota",
    status: "no_license",
    notes:
      "No state license required. Our course qualifies you for InterNACHI certification.",
  },
  {
    code: "OH",
    name: "Ohio",
    status: "license_required",
    notes:
      "Home inspectors in Ohio need a state license through the Division of Real Estate. We're working on Ohio approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "OK",
    name: "Oklahoma",
    status: "no_license",
    notes:
      "No state license required. Our course qualifies you for InterNACHI certification.",
  },
  {
    code: "OR",
    name: "Oregon",
    status: "license_required",
    notes:
      "Home inspectors in Oregon need a state CCB certification. We're working on Oregon approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "PA",
    name: "Pennsylvania",
    status: "license_required",
    notes:
      "Home inspectors in Pennsylvania must be members of an approved national association. We're working on Pennsylvania approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "RI",
    name: "Rhode Island",
    status: "license_required",
    notes:
      "Home inspectors in Rhode Island need a state license through the Department of Business Regulation. We're working on Rhode Island approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "SC",
    name: "South Carolina",
    status: "license_required",
    notes:
      "Home inspectors in South Carolina need a state license through LLR. We're working on South Carolina approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "SD",
    name: "South Dakota",
    status: "no_license",
    notes:
      "No state license required. Our course qualifies you for InterNACHI certification.",
  },
  {
    code: "TN",
    name: "Tennessee",
    status: "license_required",
    notes:
      "Home inspectors in Tennessee need a state license through the Department of Commerce & Insurance. We're working on Tennessee approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "TX",
    name: "Texas",
    status: "license_required",
    notes:
      "Home inspectors in Texas need a state license through TREC. We're working on Texas approval — join our waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "UT",
    name: "Utah",
    status: "license_required",
    notes:
      "Home inspectors in Utah need a state license. We're working on Utah approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "VT",
    name: "Vermont",
    status: "license_required",
    notes:
      "Home inspectors in Vermont need a state license. We're working on Vermont approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "VA",
    name: "Virginia",
    status: "license_required",
    notes:
      "Home inspectors in Virginia need a state license through DPOR. We're working on Virginia approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "WA",
    name: "Washington",
    status: "no_license",
    notes:
      "No state license required. Our course qualifies you for InterNACHI certification.",
  },
  {
    code: "WV",
    name: "West Virginia",
    status: "license_required",
    notes:
      "Home inspectors in West Virginia need a state license. We're working on West Virginia approval — join the waitlist and we'll notify you when it's available.",
    waitlist: true,
  },
  {
    code: "WI",
    name: "Wisconsin",
    status: "no_license",
    notes:
      "No state license required. Our course qualifies you for InterNACHI certification.",
  },
  {
    code: "WY",
    name: "Wyoming",
    status: "no_license",
    notes:
      "No state license required. Our course qualifies you for InterNACHI certification.",
  },
];

export function getStateByCode(code: string): StateInfo | undefined {
  const target = code.toUpperCase();
  return HOME_INSPECTOR_STATES.find((s) => s.code === target);
}
