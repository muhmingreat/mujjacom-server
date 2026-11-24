const createRequirement = (
  type,
  label,
  required = true,
  description = ""
) => ({
  documentType: type,
  label,
  required,
  description,
});

const commonSaleDocuments = [
  createRequirement(
    "proof_of_ownership",
    "Proof of Ownership",
    true,
    "Evidence establishing the seller's ownership or legal interest in the property."
  ),
  createRequirement(
    "deed_of_assignment",
    "Deed of Assignment",
    true,
    "Relevant assignment document showing the transfer of interest."
  ),
  createRequirement(
    "land_registry_search",
    "Land Registry Search",
    false,
    "Search results confirming available registry records."
  ),
  createRequirement(
    "encumbrance_search",
    "Encumbrance Search",
    false,
    "Evidence of any mortgages, claims, restrictions or competing interests."
  ),
];

const commonRentalDocuments = [
  createRequirement(
    "proof_of_ownership",
    "Proof of Ownership",
    true,
    "Evidence of the landlord's ownership or legal interest."
  ),
  createRequirement(
    "authority_to_let",
    "Authority to Let",
    true,
    "Evidence that the person offering the property is authorized to rent it."
  ),
  createRequirement(
    "property_condition_report",
    "Property Condition Report",
    true,
    "A record of the property's condition before occupation."
  ),
  createRequirement(
    "tenancy_agreement",
    "Tenancy Agreement",
    false,
    "Draft or existing tenancy agreement, where applicable."
  ),
];

const commonLeaseDocuments = [
  createRequirement(
    "proof_of_ownership",
    "Proof of Ownership",
    true,
    "Evidence of the owner's legal interest in the property."
  ),
  createRequirement(
    "authority_to_lease",
    "Authority to Lease",
    true,
    "Evidence that the person offering the lease has authority to do so."
  ),
  createRequirement(
    "lease_agreement",
    "Lease Agreement",
    true,
    "Proposed or executed lease agreement."
  ),
  createRequirement(
    "encumbrance_search",
    "Encumbrance Search",
    false,
    "Evidence of restrictions or competing interests affecting the lease."
  ),
];

const requirements = {
  land: {
    sale: [
      ...commonSaleDocuments,
      createRequirement("survey_plan", "Survey Plan", true),
      createRequirement(
        "certificate_of_occupancy",
        "Certificate of Occupancy",
        false,
        "Where applicable to the property's title."
      ),
      createRequirement("allocation_letter", "Allocation Letter", false),
      createRequirement("governor_consent", "Governor's Consent", false),
    ],

    rent: [
      ...commonRentalDocuments,
      createRequirement("survey_plan", "Survey Plan", false),
      createRequirement("title_deed", "Title Deed", false),
    ],

    lease: [
      ...commonLeaseDocuments,
      createRequirement("survey_plan", "Survey Plan", false),
      createRequirement("title_deed", "Title Deed", false),
    ],
  },

  house: {
    sale: [
      ...commonSaleDocuments,
      createRequirement("title_deed", "Title Deed", true),
      createRequirement("survey_plan", "Survey Plan", true),
      createRequirement("approved_building_plan", "Approved Building Plan", false),
      createRequirement("building_approval", "Building Approval", false),
      createRequirement("certificate_of_occupancy", "Certificate of Occupancy", false),
    ],

    rent: [
      ...commonRentalDocuments,
      createRequirement("title_deed", "Title Deed", false),
      createRequirement("building_approval", "Building Approval", false),
    ],

    lease: [
      ...commonLeaseDocuments,
      createRequirement("title_deed", "Title Deed", false),
      createRequirement("building_approval", "Building Approval", false),
    ],
  },

  apartment: {
    sale: [
      ...commonSaleDocuments,
      createRequirement("title_deed", "Title Deed", true),
      createRequirement("survey_plan", "Survey Plan", false),
      createRequirement("approved_building_plan", "Approved Building Plan", false),
      createRequirement("certificate_of_occupancy", "Certificate of Occupancy", false),
    ],

    rent: [
      ...commonRentalDocuments,
      createRequirement("management_authorization", "Management Authorization", false),
      createRequirement("building_approval", "Building Approval", false),
    ],

    lease: [
      ...commonLeaseDocuments,
      createRequirement("management_authorization", "Management Authorization", false),
      createRequirement("building_approval", "Building Approval", false),
    ],
  },

  commercial: {
    sale: [
      ...commonSaleDocuments,
      createRequirement("title_deed", "Title Deed", true),
      createRequirement("survey_plan", "Survey Plan", true),
      createRequirement("approved_building_plan", "Approved Building Plan", false),
      createRequirement("building_approval", "Building Approval", false),
      createRequirement("certificate_of_occupancy", "Certificate of Occupancy", false),
    ],

    rent: [
      ...commonRentalDocuments,
      createRequirement("management_authorization", "Management Authorization", false),
      createRequirement("building_approval", "Building Approval", false),
    ],

    lease: [
      ...commonLeaseDocuments,
      createRequirement("management_authorization", "Management Authorization", false),
      createRequirement("building_approval", "Building Approval", false),
    ],
  },

  other: {
    sale: [
      ...commonSaleDocuments,
      createRequirement("title_deed", "Title Deed", false),
      createRequirement("survey_plan", "Survey Plan", false),
    ],

    rent: [...commonRentalDocuments],

    lease: [...commonLeaseDocuments],
  },
};

export const getDueDiligenceRequirements = (propertyType, transactionType) => {
  const propertyRequirements = requirements[propertyType];
  const transactionRequirements = propertyRequirements?.[transactionType];

  if (!transactionRequirements) {
    return [];
  }

  return transactionRequirements.map((item) => ({ ...item }));
};

export default getDueDiligenceRequirements;
