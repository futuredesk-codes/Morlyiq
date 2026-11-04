const clean = (value) => String(value || "").trim();

export class StediConfigurationError extends Error {
  constructor(message, code = "STEDI_CONFIGURATION_INVALID") {
    super(message);
    this.name = "StediConfigurationError";
    this.code = code;
  }
}

export const envEnabled = (value) => clean(value).toLowerCase() === "true";

const normalizeMode = (value, variableName) => {
  const mode = clean(value || "test").toLowerCase();
  if (!["test", "production"].includes(mode)) {
    throw new StediConfigurationError(
      `${variableName} must be either test or production`,
      "STEDI_MODE_INVALID"
    );
  }
  return mode;
};

export const getClaimsMode = () => normalizeMode(
  process.env.STEDI_CLAIMS_MODE || process.env.STEDI_ENVIRONMENT || "test",
  "STEDI_CLAIMS_MODE"
);

export const getEraMode = () => normalizeMode(
  process.env.STEDI_ERA_MODE || process.env.STEDI_ENVIRONMENT || process.env.STEDI_CLAIMS_MODE || "test",
  "STEDI_ERA_MODE"
);

export const getStediApiKey = (feature = "claims") => {
  const mode = feature === "era" ? getEraMode() : getClaimsMode();
  const featureKeys = {
    claims: process.env.STEDI_CLAIMS_API_KEY,
    era: process.env.STEDI_ERA_API_KEY,
    eligibility: process.env.STEDI_ELIGIBILITY_API_KEY,
  };
  const featureKey = featureKeys[feature];
  const modeKey = mode === "production"
    ? process.env.STEDI_PRODUCTION_API_KEY
    : process.env.STEDI_TEST_API_KEY;
  // Mode-specific keys take priority so both credentials can remain configured
  // and deployment only needs to switch the mode variables.
  return clean(modeKey || featureKey || process.env.STEDI_API_KEY);
};

export const assertStediRuntimeSafety = () => {
  const claimsMode = getClaimsMode();
  const eraMode = getEraMode();
  const claimsModeWasSet = clean(process.env.STEDI_CLAIMS_MODE || process.env.STEDI_ENVIRONMENT);
  const eraModeWasSet = clean(process.env.STEDI_ERA_MODE || process.env.STEDI_ENVIRONMENT);

  if (claimsModeWasSet && eraModeWasSet && claimsMode !== eraMode) {
    throw new StediConfigurationError(
      "STEDI_CLAIMS_MODE and STEDI_ERA_MODE must match so claims and remittances cannot cross environments",
      "STEDI_MODE_MISMATCH"
    );
  }

  if (claimsMode === "production") {
    const enabledMockFlags = [
      ["STEDI_TEST_CLAIM_MOCK_ENABLED", process.env.STEDI_TEST_CLAIM_MOCK_ENABLED],
      ["STEDI_ELIGIBILITY_MOCK_ENABLED", process.env.STEDI_ELIGIBILITY_MOCK_ENABLED],
    ].filter(([, value]) => envEnabled(value)).map(([name]) => name);

    if (enabledMockFlags.length) {
      throw new StediConfigurationError(
        `Production Stedi mode cannot start while mock flags are enabled: ${enabledMockFlags.join(", ")}`,
        "STEDI_PRODUCTION_MOCKS_ENABLED"
      );
    }
  }

  return { claimsMode, eraMode };
};

export const isTestClaimsMode = () => getClaimsMode() === "test";

