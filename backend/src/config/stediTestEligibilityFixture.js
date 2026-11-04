// Exact synthetic dental eligibility identity published by Stedi for test mode.
// Never replace these values with real patient PHI/PII.
export const STEDI_TEST_ELIGIBILITY_FIXTURE = Object.freeze({
  payer: {
    name: "MetLife Dental Family",
    id: "10134",
  },
  provider: {
    organizationName: "One",
    npi: "1999999984",
  },
  subscriber: {
    firstName: "Elephant",
    lastName: "Dent",
    fullName: "Elephant Dent",
    dateOfBirth: "1984-02-29",
    memberId: "88877788",
  },
  encounter: {
    services: [{ system: "STC", value: "35" }],
  },
});
