// Synthetic development data only. Never put real patient PHI/PII in this fixture.
// The provider NPI and EIN must match the provider enrolled with Stedi Test Payer.
export const STEDI_TEST_CLAIM_FIXTURE = Object.freeze({
  payer: {
    name: "Stedi Test Payer",
    id: "STEDI",
  },
  provider: {
    organizationName: "MorlyIQ Test Dental",
    npi: "1999999984",
    taxonomyCode: "122300000X",
    employerId: "927406381",
    // NANP-safe fictional number: both area code and exchange begin with 2-9.
    phoneNumber: "3135550123",
    submitterId: "",
    address: {
      address1: "123 Test Street",
      city: "Denver",
      state: "CO",
      postalCode: "80238",
      countryCode: "US",
    },
  },
  subscriber: {
    firstName: "Elephant",
    lastName: "Dent",
    dateOfBirth: "19840229",
    gender: "M",
    memberId: "STEDI_PAID_88877788",
    groupNumber: "TEST-GROUP",
    address: {
      address1: "456 Test Avenue",
      city: "Denver",
      state: "CO",
      postalCode: "80238",
      countryCode: "US",
    },
  },
  service: {
    cdtCode: "D0120",
    chargeCents: 10_000,
    units: 1,
    placeOfServiceCode: "11",
    claimFilingCode: "CI",
  },
});
