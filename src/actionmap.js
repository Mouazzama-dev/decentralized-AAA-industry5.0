// =======================
// 🏭 SMART FACTORY ACTION MAP
// Digital Twin + DID/SSI Ready
// =======================

export const ACTION_MAP = {
  // =======================
  // 🔹 CORE MACHINE CONTROL (0–9)
  // =======================
  START: 0,
  STOP: 1,
  PAUSE: 2,
  RESUME: 3,
  RESET: 4,
  EMERGENCY_STOP: 5,
  SWITCH_ON: 6,
  SWITCH_OFF: 7,

  // =======================
  // 🔹 MOTION & CONTROL (10–29)
  // =======================
  MOVE_UP: 10,
  MOVE_DOWN: 11,
  MOVE_LEFT: 12,
  MOVE_RIGHT: 13,
  MOVE_FORWARD: 14,
  MOVE_BACKWARD: 15,
  ROTATE: 16,
  ROTATE_CLOCKWISE: 17,
  ROTATE_COUNTERCLOCKWISE: 18,
  SET_POSITION: 19,
  HOME_POSITION: 20,
  CALIBRATE: 21,

  // =======================
  // 🔹 MANUFACTURING / PROCESSING (30–49)
  // =======================
  CUT: 30,
  DRILL: 31,
  MILL: 32,
  GRIND: 33,
  WELD: 34,
  PAINT: 35,
  ASSEMBLE: 36,
  DISASSEMBLE: 37,
  PRINT_3D: 38,

  // =======================
  // 🔹 MATERIAL HANDLING (50–69)
  // =======================
  PICK: 50,
  PLACE: 51,
  LOAD: 52,
  UNLOAD: 53,
  TRANSFER: 54,
  SORT: 55,
  PACK: 56,
  UNPACK: 57,
  PALLETIZE: 58,
  DEPALLETIZE: 59,

  // =======================
  // 🔹 QUALITY CONTROL (70–89)
  // =======================
  INSPECT: 70,
  SCAN: 71,
  MEASURE: 72,
  DETECT_DEFECT: 73,
  VERIFY: 74,
  TEST: 75,
  VALIDATE: 76,

  // =======================
  // 🔹 PROCESS & ENVIRONMENT (90–109)
  // =======================
  SET_TEMPERATURE: 90,
  SET_PRESSURE: 91,
  SET_SPEED: 92,
  SET_FEED_RATE: 93,
  SET_HUMIDITY: 94,
  ADJUST_PARAMETER: 95,
  MONITOR: 96,

  // =======================
  // 🔹 SECURITY & ACCESS (110–129)
  // =======================
  AUTHORIZE: 110,
  AUTHENTICATE: 111,
  ISSUE_PERMIT: 112,
  REVOKE_ACCESS: 113,
  LOCK_MACHINE: 114,
  UNLOCK_MACHINE: 115,
  LOG_ACCESS: 116,

  // =======================
  // 🔹 DIGITAL TWIN & AI (130–149)
  // =======================
  SYNC_TWIN: 130,
  SIMULATE: 131,
  PREDICT_FAILURE: 132,
  RUN_DIAGNOSTIC: 133,
  OPTIMIZE_PROCESS: 134,
  UPDATE_MODEL: 135,
  COLLECT_DATA: 136,
  ANALYZE_DATA: 137,

  // =======================
  // 🔹 MAINTENANCE (150–169)
  // =======================
  MAINTAIN: 150,
  REPAIR: 151,
  LUBRICATE: 152,
  REPLACE_PART: 153,
  SCHEDULE_MAINTENANCE: 154,
  RUN_SELF_TEST: 155
};

// =======================
// 📋 ALL ACTION NAMES
// =======================
export const ALLOWED_ACTIONS = Object.keys(ACTION_MAP);

// =======================
// 🔍 REVERSE LOOKUP (optional but useful)
// =======================
export const ACTION_NAMES = Object.fromEntries(
  Object.entries(ACTION_MAP).map(([key, val]) => [val, key])
);