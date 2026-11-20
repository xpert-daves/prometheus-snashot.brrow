export type ServiceAreaFaq = {
  question: string;
  answer: string;
};

export type ServiceAreaRelatedGuide = {
  href: `/news/${string}`;
  title: string;
  description: string;
};

export type ServiceAreaDeliveryCoverage = {
  heading: string;
  description: string;
  details: readonly string[];
};

export type ServiceArea = {
  city: string;
  slug: string;
  county: string;
  title: string;
  description: string;
  contentLastModified?: string;
  intro: string;
  localAreas?: readonly string[];
  deliveryCoverage?: ServiceAreaDeliveryCoverage;
  relatedGuides?: readonly ServiceAreaRelatedGuide[];
  projectProofMode?: "linked-gallery";
  planningNotes: readonly string[];
  permitNotes?: readonly {
    label: string;
    text: string;
    href?: string;
  }[];
  processSteps?: readonly {
    title: string;
    text: string;
  }[];
  warrantyNotes?: readonly string[];
  accessNote: string;
  schedulingNote: string;
  nearbySlugs: readonly string[];
  faqs: readonly ServiceAreaFaq[];
};

export const SERVICE_AREA_LAST_MODIFIED = "2026-08-21";

export const SERVICE_AREAS = [
  {
    city: "San Antonio",
    slug: "san-antonio",
    contentLastModified: "2026-09-22",
    county: "Bexar County",
    title: "Sheds in San Antonio: Local Projects & Planning",
    description:
      "Plan a shed in San Antonio with completed local builds, permit and HOA resources, site-access checks, and a current size-and-options estimate.",
    intro:
      "Shed210 builds custom sheds across San Antonio for storage, backyard workshops, hobby rooms, and utility spaces. This page focuses on local planning details: where we build, what project proof looks like, how permits and HOAs can affect the scope, and what to expect before build day.",
    localAreas: [
      "Alamo Ranch",
      "Stone Oak",
      "Leon Valley",
      "Helotes area",
      "Castle Hills",
      "Medical Center",
      "Shavano Park area",
      "Far West Side",
      "Northwest San Antonio",
      "Northeast San Antonio",
      "Southside San Antonio",
      "Bexar County service-area homes",
    ],
    deliveryCoverage: {
      heading: "San Antonio service area and build access",
      description:
        "Shed210 checks the build address against our 35-mile service area. There is no distance fee within that radius, and final service availability is confirmed by build address before scheduling.",
      details: [
        "Coverage includes homes across San Antonio plus nearby Bexar County and Hill Country communities shown on our service-area map.",
        "Gate width, material access, slope, drainage, and the route to the pad can affect the build plan even when an address is within the service area.",
        "City limits, HOA boundaries, and permit jurisdiction do not always match mailing addresses, so approval requirements are confirmed separately.",
      ],
    },
    relatedGuides: [
      {
        href: "/news/san-antonio-shed-cost-guide",
        title: "San Antonio Shed Cost Guide",
        description:
          "Compare the real price drivers, site costs, and budget decisions that shape a local shed quote.",
      },
      {
        href: "/news/sanantonio_shed_guide",
        title: "San Antonio Shed Permits and HOA Guide",
        description:
          "Review City permit checkpoints, HOA questions, setbacks, and site details before build day.",
      },
    ],
    projectProofMode: "linked-gallery",
    planningNotes: [
      "San Antonio yards often need a quick access review for fences, gates, slope, drainage, and the route for materials from the crew's parking point to the pad area.",
      "Many neighborhoods have HOA standards for colors, placement, roof style, height, materials, and visibility from the street.",
      "The City of San Antonio says accessory structures greater than 300 sq. ft. require a permit and that building setbacks apply; confirm the project-specific path before finalizing a larger build.",
      "Compare completed local projects by footprint, wall height, doors, floor, and finish. A published project's price describes that build; use the instant quote for your own current configuration.",
      "The instant result is an estimated build subtotal. Travel and site costs are confirmed separately, so send the build location and access photos before comparing final quotes.",
    ],
    permitNotes: [
      {
        label: "City DSD homeowner FAQ",
        text: "San Antonio's Development Services FAQ says a permit is required for an accessory structure greater than 300 sq. ft. and that setbacks apply.",
        href: "https://www.sa.gov/Directory/Departments/DSD/Resources/Getting-Started",
      },
      {
        label: "Residential permits page",
        text: "The residential permits page lists accessory-structure permit categories and site-plan requirements, so larger or unusual projects should be checked against the current DSD process.",
        href: "https://www.sa.gov/Directory/Departments/DSD/Constructing/Residential/Permits",
      },
      {
        label: "HOA review",
        text: "HOA covenants are separate from city permitting. If your neighborhood has an architectural review process, get those requirements before locking color, roof, placement, and size.",
      },
    ],
    processSteps: [
      {
        title: "Quote",
        text: "Start with size, structure type, materials, doors, windows, build ZIP, and any known HOA constraints.",
      },
      {
        title: "Local fit check",
        text: "Share photos of the placement area and access route so the build plan accounts for gates, slopes, trees, utilities, and drainage.",
      },
      {
        title: "Approvals",
        text: "For larger San Antonio projects or HOA neighborhoods, confirm the permit and architectural-review path before build timing is finalized.",
      },
      {
        title: "Build day",
        text: "Most projects are built on-site in one day after the scope, access, and scheduling details are confirmed.",
      },
    ],
    warrantyNotes: [
      "Two-year workmanship warranty on Shed210 build labor.",
      "Forty-year metal warranty on qualifying metal materials.",
      "A $250 deposit holds the build day. No final payment until the build is complete.",
    ],
    accessNote:
      "Share gate width, side-yard access, and a few placement photos so the build crew can confirm how materials will reach the pad area.",
    schedulingNote:
      "Most local projects are built on-site in one day after details, access, and timing are confirmed.",
    nearbySlugs: ["schertz", "universal-city", "cibolo", "converse", "helotes"],
    faqs: [
      {
        question: "Do San Antonio shed projects usually need HOA review?",
        answer:
          "Many neighborhoods do. Check your HOA rules early for placement, color, roof, and size requirements so the shed design matches the approval path.",
      },
      {
        question: "Do I need a City of San Antonio permit for a shed?",
        answer:
          "The City's Development Services FAQ says accessory structures greater than 300 sq. ft. require a permit and that setbacks apply. Smaller projects can still have zoning, utility, HOA, or special-district constraints, so confirm the property-specific requirement before building.",
      },
      {
        question: "Can Shed210 help me compare shed sizes?",
        answer:
          "Yes. We can use your storage list, yard photos, and preferred placement to help narrow the size before you approve a quote.",
      },
    ],
  },
  {
    city: "Universal City",
    slug: "universal-city",
    contentLastModified: "2026-09-07",
    county: "Bexar County",
    title: "Custom Sheds in Universal City, TX",
    description:
      "Plan a custom shed in Universal City, TX: compare sizes, check city permit resources, prepare your site, and get an instant Shed210 price.",
    intro:
      "Universal City homeowners often need a shed that fits established neighborhoods, tighter lots, and everyday storage needs without dragging out the project. Shed210 helps turn the size, access, and layout questions into a clear build plan.",
    planningNotes: [
      "Side-yard access and fence openings are important details to confirm before build day.",
      "A compact footprint can still work well when doors, windows, and shelving plans are chosen around daily use.",
      "Neighborhood rules may affect exterior colors or where the shed can sit on the lot.",
    ],
    permitNotes: [
      {
        label: "Universal City shed permits",
        text: "Universal City's permit page lists storage sheds, including new installations and relocated sheds, among accessory buildings requiring a permit before work begins. Confirm the requirements for your exact address and design with Development Services.",
        href: "https://universalcitytexas.gov/540/Permits",
      },
      {
        label: "City review and neighborhood approval",
        text: "The City's Building/Permits FAQ says deed-restricted properties must also meet HOA requirements. Check both approval paths before choosing the shed's placement, height, exterior finish, and roof style.",
        href: "https://www.universalcitytexas.gov/faq.aspx?TID=27",
      },
    ],
    relatedGuides: [
      {
        href: "/news/san-antonio-shed-cost-guide",
        title: "Compare shed sizes and cost drivers",
        description: "Use our San Antonio-area cost guide to plan your budget, then price your size and options in the quote builder. Universal City permit requirements are checked separately.",
      },
    ],
    processSteps: [
      {
        title: "Choose a useful footprint",
        text: "List the equipment you will store and measure its widest item. Leave room for door swing and a walkway, then compare building types and sizes before requesting a price.",
      },
      {
        title: "Prepare the site details",
        text: "Send photos from the driveway to the proposed pad, the narrowest access measurement, and notes about drainage or obstructions. Include the planned shed dimensions and placement when asking the City about approvals.",
      },
      {
        title: "Confirm approvals before scheduling",
        text: "Review Universal City's current permit instructions and any HOA requirements. Finalize the build scope and access plan after the property-specific approval path is clear.",
      },
    ],
    accessNote:
      "Measure the narrowest gate or side-yard point and note air-conditioning units, trees, or utility boxes near the access path.",
    schedulingNote:
      "Once the design and access details are confirmed, most Universal City builds can be completed in a single visit.",
    nearbySlugs: ["san-antonio", "schertz", "cibolo", "converse"],
    faqs: [
      {
        question: "What shed size works best for smaller Universal City lots?",
        answer:
          "The best size depends on what you need to store and how the doors will open. A focused layout can often provide more usable space than a larger but poorly planned shed.",
      },
      {
        question: "Can I send photos instead of scheduling a site visit first?",
        answer:
          "Yes. Clear photos of the access route and placement area are a strong first step for quote and scheduling guidance.",
      },
    ],
  },
  {
    city: "Schertz",
    slug: "schertz",
    contentLastModified: "2026-09-23",
    county: "Guadalupe, Bexar, and Comal Counties",
    title: "Custom Sheds in Schertz, TX",
    description:
      "Schertz custom shed builders for backyard storage, lawn equipment, workshops, and HOA-aware shed planning.",
    intro:
      "Shed210 builds custom sheds for Schertz homeowners who want useful storage without a complicated construction process. We help match the shed footprint, entry points, and finish details to your yard and neighborhood requirements.",
    planningNotes: [
      "Schertz addresses can fall under different county or neighborhood requirements, so confirm the specific property rules early.",
      "Larger lots may offer more placement options, but drainage and mower access still matter.",
      "Door placement is especially important when the shed will store lawn equipment or outdoor gear.",
    ],
    permitNotes: [
      {
        label: "Schertz shed placement rules",
        text: "The City's shed guide lists a five-foot side-yard setback and a three-foot rear-yard setback, and excludes front yards and easements. It also notes different requirements for lots of half an acre or more. Check your survey and lot-specific rules before choosing the pad location.",
        href: "https://schertz.com/223/Carport-Shed-Garage-Sale-Information",
      },
      {
        label: "Shed and foundation permit questions",
        text: "Schertz says sheds over 120 square feet require a permit and a permanent foundation needs a foundation/flatwork permit. For a 120-square-foot design, ask the City to confirm the permit requirement: its published pages describe that boundary differently. Smaller sheds still need to meet placement rules.",
        href: "https://www.schertz.com/2314/Frequently-Asked-Questions",
      },
    ],
    relatedGuides: [
      {
        href: "/news/san-antonio-shed-cost-guide",
        title: "Compare footprints, options, and site costs",
        description:
          "Use the regional cost guide to compare layouts and quote inclusions, then check Schertz permits and HOA requirements for the chosen design.",
      },
    ],
    processSteps: [
      {
        title: "Mark the usable space",
        text: "Use your property survey to identify boundaries and easements. Measure the proposed footprint, door swing, and the route for moving a mower in and out; a fence alone does not establish the legal boundary.",
      },
      {
        title: "Confirm the foundation and approvals",
        text: "Tell the City the shed dimensions and foundation type, and ask which permits and drawings apply. If you have an HOA, request its placement, height, roof, and finish requirements before settling the design.",
      },
      {
        title: "Match the quote to the site",
        text: "Send the build address, pad and access photos, and the approved design details. Compare the building estimate with any separately confirmed site or travel costs before scheduling.",
      },
    ],
    accessNote:
      "Send photos from the driveway to the planned shed location, including turns, gates, slopes, and any low branches.",
    schedulingNote:
      "After quote approval, scheduling focuses on weather, yard access, and material readiness so the on-site build stays efficient.",
    nearbySlugs: ["cibolo", "universal-city", "seguin", "converse", "marion"],
    faqs: [
      {
        question: "Do Schertz shed rules vary by neighborhood?",
        answer:
          "They can. HOA standards, setbacks, and visibility rules may vary, so it is worth checking property-specific requirements before finalizing the design.",
      },
      {
        question: "Can I design the shed around lawn equipment storage?",
        answer:
          "Yes. Door width, ramp planning, and interior clearances can be selected around mowers, tools, and seasonal storage.",
      },
    ],
  },
  {
    city: "Cibolo",
    slug: "cibolo",
    contentLastModified: "2026-09-23",
    county: "Guadalupe County",
    title: "Custom Sheds in Cibolo, TX",
    description:
      "One-day custom shed builds in Cibolo with clear options for storage, backyard workshops, HOA planning, and site access.",
    intro:
      "Cibolo shed projects often need to balance growing-family storage needs with subdivision standards and backyard access. Shed210 helps you choose a shed that fits the lot, the rule set, and the way you plan to use the space.",
    planningNotes: [
      "Newer subdivisions may have detailed HOA requirements for shed visibility, materials, colors, and roof style.",
      "Backyard access can change the build approach, especially on lots with narrow side yards.",
      "Planning around kids' gear, tools, and seasonal storage can keep the shed useful from day one.",
    ],
    permitNotes: [
      {
        label: "Cibolo residential permit checklist",
        text: "Cibolo's residential process asks applicants to prepare a site plan locating the structure and property lines, plus project plans or a description. Applications and inspections use MGO Connect. Confirm the requirements for your shed's size, foundation, and any electrical work with Building Inspections before starting.",
        href: "https://www.cibolotx.gov/business/building_permits___inspections/residential_projects.php",
      },
      {
        label: "Find your neighborhood's HOA contact",
        text: "The City maintains a subdivision map and HOA contact directory. Use it to locate the right association, then request its current shed application and design rules. City permitting and neighborhood architectural approval are separate checks.",
        href: "https://www.cibolotx.gov/community/neighborhood_associations.php",
      },
    ],
    relatedGuides: [
      {
        href: "/news/san-antonio-shed-cost-guide",
        title: "Plan a shed budget before choosing finishes",
        description:
          "Compare regional project examples, doors, flooring, and site-cost questions. Published project prices describe those builds; get a current estimate for your Cibolo address and options.",
      },
    ],
    processSteps: [
      {
        title: "Collect the property and HOA details",
        text: "Find your survey and neighborhood's architectural application. Mark the proposed shed footprint and ask about roof style, materials, height, and visibility before choosing finishes.",
      },
      {
        title: "Prepare the City review information",
        text: "Have the shed dimensions, foundation approach, proposed location, and intended use ready for Building Inspections. Confirm the permit path and required documents before reserving build timing.",
      },
      {
        title: "Check the route into the backyard",
        text: "Send the narrowest gate measurement and photos showing turns, air-conditioning units, and the pad. Match those access details to the size and options in your estimate before approving the scope.",
      },
    ],
    accessNote:
      "Confirm whether materials can move through a side gate or whether the crew needs a different access plan.",
    schedulingNote:
      "Most Cibolo projects are scheduled after HOA-sensitive design choices and access details are settled.",
    nearbySlugs: ["schertz", "new-braunfels", "seguin", "converse", "marion"],
    faqs: [
      {
        question:
          "Should I check HOA rules before getting a Cibolo shed quote?",
        answer:
          "Yes. You can still start a quote first, but HOA rules help avoid redesigning the shed after choosing size, color, or roof details.",
      },
      {
        question: "Can Shed210 build on-site if my backyard access is tight?",
        answer:
          "Often, yes. Share gate and access details early so the build plan accounts for the route into the backyard.",
      },
    ],
  },
  {
    city: "New Braunfels",
    slug: "new-braunfels",
    contentLastModified: "2026-09-23",
    county: "Comal and Guadalupe Counties",
    title: "Custom Sheds in New Braunfels, TX",
    description:
      "New Braunfels custom sheds for storage, workshops, river gear, lawn equipment, and backyard organization with local site planning.",
    intro:
      "New Braunfels homeowners use sheds for everything from lawn equipment and tools to river gear and overflow storage. Shed210 builds custom sheds with practical layouts and site planning for local lots, slopes, and access conditions.",
    planningNotes: [
      "Some properties need extra attention to slope, drainage, and placement because of terrain or lot shape.",
      "Storage plans should account for bulky outdoor equipment, coolers, seasonal items, and long-handled tools.",
      "HOA or neighborhood standards may affect exterior choices even when the shed is primarily functional.",
    ],
    permitNotes: [
      {
        label: "New Braunfels accessory-building permits",
        text: "The City's online residential permit options include Accessory Building, Foundation, and Flatwork, with separate electrical permits available. Share the footprint, foundation, planned utilities, and build address with Building Safety to confirm the right applications. The City also lists floodplain and historic-property reviews, which may affect the approval path for a particular lot.",
        href: "https://newbraunfels.gov/buildingpermits",
      },
      {
        label: "Site and neighborhood planning",
        text: "Use your property survey and placement photos when checking setbacks, easements, drainage, and HOA restrictions. Resolve the usable pad location and any approval conditions before finalizing shed dimensions or ordering site work.",
      },
    ],
    relatedGuides: [
      {
        href: "/news/san-antonio-shed-cost-guide",
        title: "Separate the building estimate from site costs",
        description:
          "Compare regional size and option examples, then confirm travel, foundation, access, and any utility work for your New Braunfels property.",
      },
    ],
    accessNote:
      "Photos of the planned location, grade, drainage direction, and access route help identify any site questions early.",
    schedulingNote:
      "Build timing is coordinated around confirmed design choices, weather, and access so most projects can stay to a one-day build.",
    nearbySlugs: ["schertz", "cibolo", "bulverde"],
    faqs: [
      {
        question: "Can a shed be planned around uneven New Braunfels yards?",
        answer:
          "Yes. The right placement and foundation approach depend on the slope, drainage, and how you want to use the shed.",
      },
      {
        question: "What should I send for a faster quote?",
        answer:
          "Send preferred size, storage goals, a few yard photos, and any HOA requirements you already know.",
      },
    ],
  },
  {
    city: "Boerne",
    slug: "boerne",
    contentLastModified: "2026-09-22",
    county: "Kendall County",
    title: "Custom Sheds in Boerne, TX",
    description:
      "Custom sheds in Boerne for Hill Country storage, equipment, workshops, and acreage properties with careful site planning.",
    intro:
      "Boerne shed projects often involve Hill Country terrain, acreage storage, and a need for a structure that looks right on the property. Shed210 helps plan the size, placement, and finish details before the on-site build.",
    relatedGuides: [
      {
        href: "/news/san-antonio-shed-cost-guide",
        title: "Compare storage footprints and quote inclusions",
        description:
          "Compare 8x10 and 10x12 layouts, historical price examples, and the items to confirm in a current estimate. Check Boerne-area approvals separately for your address.",
      },
    ],
    planningNotes: [
      "Hill Country lots can require extra review of slope, drainage, trees, and driveway-to-yard access.",
      "Larger properties may need a shed layout built around equipment, feed, tools, or workshop use.",
      "Exterior style and placement can matter when the shed is visible from the home, road, or neighboring properties.",
      "Use the completed Boerne projects below to compare photos, dimensions, doors, and finishes. Each project price belongs to its recorded configuration; it is not a current package price for another property.",
    ],
    accessNote:
      "Share driveway conditions, distance from crew parking to the shed site, slope, and any low-water or rough access concerns.",
    schedulingNote:
      "Boerne scheduling should account for access distance, weather, and site readiness before the crew arrives.",
    nearbySlugs: ["san-antonio", "bulverde", "lakehills"],
    faqs: [
      {
        question: "Can Shed210 build sheds for acreage properties near Boerne?",
        answer:
          "Yes. A good quote should account for the storage use, access route, site conditions, and finish expectations for the property.",
      },
      {
        question: "What site details matter most for Hill Country sheds?",
        answer:
          "Slope, drainage, access distance, trees, and ground conditions are the most important details to share early.",
      },
      {
        question: "Does the instant estimate include travel and site work for Boerne?",
        answer:
          "The instant result is an estimated build subtotal. Travel and site costs need confirmation for the exact build address. Share the driveway, access route, slope, and planned foundation so the final scope can be checked before scheduling.",
      },
    ],
  },
  {
    city: "Poteet",
    slug: "poteet",
    county: "Atascosa County",
    title: "Custom Sheds in Poteet, TX",
    description:
      "Poteet custom sheds for storage, equipment, tools, and rural properties with clear pricing and on-site construction.",
    intro:
      "Poteet homeowners and rural property owners often need sheds that handle tools, outdoor gear, equipment, and seasonal storage. Shed210 builds custom sheds on-site with a clear plan for size, placement, and access.",
    planningNotes: [
      "Rural and semi-rural properties may have more placement flexibility, but access distance and ground conditions still affect planning.",
      "Equipment storage works best when door width, ramp needs, and interior layout are chosen before the quote is approved.",
      "A simple, durable shed can be tailored for tools, garden supplies, feed, or general property storage.",
    ],
    accessNote:
      "Note driveway surface, crew parking, material staging space, distance to the build location, and whether the site is level and dry.",
    schedulingNote:
      "Poteet builds are scheduled around site readiness, travel planning, and weather so the on-site work can move efficiently.",
    nearbySlugs: ["pleasanton", "lytle", "floresville"],
    faqs: [
      {
        question: "Can Shed210 build for rural properties near Poteet?",
        answer:
          "Yes. Share access, ground, and placement details so the quote reflects the real build conditions.",
      },
      {
        question: "Can the shed be planned for equipment storage?",
        answer:
          "Yes. Door width, ramp planning, and interior clearance can be matched to the equipment you expect to store.",
      },
    ],
  },
  {
    city: "Floresville",
    slug: "floresville",
    county: "Wilson County",
    title: "Custom Sheds in Floresville, TX",
    description:
      "Custom sheds in Floresville for backyard storage, equipment, workshops, and Wilson County properties with practical site planning.",
    intro:
      "Shed210 builds custom sheds for Floresville and nearby Wilson County properties. We help homeowners plan the footprint, access route, drainage questions, and storage layout before materials arrive for the on-site build.",
    planningNotes: [
      "Floresville reviews construction for building-code and zoning compliance, so confirm the city permit path before finalizing the shed size and placement.",
      "The city's residential application asks about floodplain status; unincorporated Wilson County properties can follow a separate county development process.",
      "For larger or semi-rural lots, driveway condition, material staging space, drainage, and the distance to the build site should be included in the quote review.",
    ],
    permitNotes: [
      {
        label: "City of Floresville building permits",
        text: "The city Building and Permits department reviews projects for building-code and zoning compliance and provides the current application path.",
        href: "https://www.floresvilletx.gov/departments/buildings-permits/",
      },
      {
        label: "Wilson County development process",
        text: "For addresses outside city limits, Wilson County's permitting and development page covers floodplain review and identifies other property-specific approvals that may apply.",
        href: "https://www.co.wilson.tx.us/page/wilson.PermittingDevelopment",
      },
    ],
    accessNote:
      "Send photos from the road or driveway to the proposed pad, including gates, soft ground, slopes, low branches, and the available material staging area.",
    schedulingNote:
      "Scheduling starts after the location, access route, jurisdiction, and any permit or floodplain questions are clear.",
    nearbySlugs: [
      "pleasanton",
      "poteet",
      "san-antonio",
      "nixon",
      "karnes-city",
    ],
    faqs: [
      {
        question: "Do I need a permit for a shed in Floresville?",
        answer:
          "Requirements depend on the property, structure, and scope. Confirm the current path with the City of Floresville for city addresses or Wilson County for an unincorporated property before construction.",
      },
      {
        question:
          "What should I send for a Floresville or rural Wilson County quote?",
        answer:
          "Send the preferred size, intended use, placement photos, driveway and gate details, and any floodplain, septic, easement, or HOA information you already have.",
      },
    ],
  },
  {
    city: "Castroville",
    slug: "castroville",
    county: "Medina County",
    title: "Custom Sheds in Castroville, TX",
    description:
      "Custom sheds in Castroville with local planning for storage, workshops, historic properties, floodplain questions, and backyard access.",
    intro:
      "Shed210 builds custom sheds for Castroville homeowners who want useful storage without overlooking local placement and approval requirements. We help organize the design, access, and site details before build day.",
    planningNotes: [
      "Castroville's published guidance says smaller residential accessory structures may qualify for a building-permit exemption only under specific conditions; confirm the current threshold and scope with Community Development.",
      "Historic properties may need Historic Landmark Commission review, and floodplain work can require separate approval regardless of a building-permit exemption.",
      "Placement still has to comply with zoning, setbacks, easements, and adopted codes even when a small structure does not require a building permit.",
    ],
    permitNotes: [
      {
        label: "City of Castroville permits and development",
        text: "The official city page explains the permit process, small residential accessory-building exemption, historic review, and where to submit current forms.",
        href: "https://www.castrovilletx.gov/2367/Permits-and-Development",
      },
      {
        label: "Medina County environmental and floodplain resources",
        text: "Unincorporated Medina County properties can have separate floodplain, septic, or development requirements.",
        href: "https://www.medinatx.gov/page/EnvironmentalHealthGroup",
      },
    ],
    accessNote:
      "Share the narrowest gate, street-to-yard route, overhead obstacles, planned foundation area, and any limits on material staging.",
    schedulingNote:
      "Historic, floodplain, or permit-sensitive projects should clear the applicable review before the build date is locked.",
    nearbySlugs: ["lytle", "san-antonio", "lakehills", "rio-medina", "natalia"],
    faqs: [
      {
        question: "When does Castroville require a shed permit?",
        answer:
          "The city's published guidance says a smaller residential accessory structure may qualify for an exemption only when its stated size and scope conditions are met, including limits on electrical, plumbing, and mechanical work. Confirm the current rule with Community Development before building.",
      },
      {
        question: "Does a historic Castroville property need extra review?",
        answer:
          "It may. Historic properties can require Historic Landmark Commission approval, so confirm status before finalizing the shed's exterior, placement, and schedule.",
      },
    ],
  },
  {
    city: "Lytle",
    slug: "lytle",
    county: "Atascosa, Bexar, and Medina Counties",
    title: "Custom Sheds in Lytle, TX",
    description:
      "Custom sheds in Lytle for storage, equipment, workshops, and growing properties across the Atascosa, Bexar, and Medina County area.",
    intro:
      "Shed210 builds custom sheds for Lytle homes and properties with a clear plan for size, use, access, and placement. Because Lytle spans three counties, identifying the property's jurisdiction early keeps the approval path from becoming a last-minute surprise.",
    planningNotes: [
      "The City of Lytle spans Atascosa, Bexar, and Medina Counties, so the exact address determines which city or county requirements apply.",
      "Lytle's current building guidance requires permits for building construction and calls for electronic applications with plans and drawings.",
      "Driveway condition, crew parking, material staging space, utilities, drainage, septic areas, and recorded easements can all affect the best shed location.",
    ],
    permitNotes: [
      {
        label: "City of Lytle building permits and inspections",
        text: "The city provides its current electronic permit, plan-submittal, inspection, and contractor-registration process online.",
        href: "https://www.lytletx.org/505/Building-Permits-Inspections",
      },
      {
        label: "City of Lytle plan review",
        text: "The plan-review page explains how drawings and supporting project information are submitted for review.",
        href: "https://www.lytletx.org/507/Plan-Review",
      },
    ],
    accessNote:
      "Photograph the crew parking and material staging location, gates, turns, trees, utility equipment, and the full route to the proposed shed pad.",
    schedulingNote:
      "Confirm the property's jurisdiction and plan-review needs before selecting a firm build date.",
    nearbySlugs: ["castroville", "poteet", "pleasanton", "natalia"],
    faqs: [
      {
        question: "Which county rules apply to my Lytle shed project?",
        answer:
          "It depends on the address. Lytle spans Atascosa, Bexar, and Medina Counties, and properties outside city limits can follow a different county process. Verify the jurisdiction before building.",
      },
      {
        question: "What does Lytle ask for during permit review?",
        answer:
          "The city's current process uses electronic applications and calls for project plans and drawings. Ask the city which documents are required for your exact shed size and scope.",
      },
    ],
  },
  {
    city: "Pleasanton",
    slug: "pleasanton",
    county: "Atascosa County",
    title: "Custom Sheds in Pleasanton, TX",
    description:
      "Custom sheds in Pleasanton for backyard storage, tools, equipment, and workshops with clear permit, setback, and access planning.",
    intro:
      "Shed210 builds custom sheds for Pleasanton homeowners who need dependable storage for tools, lawn equipment, projects, and seasonal items. We help line up the layout, placement, access, and local approval questions before build day.",
    planningNotes: [
      "Pleasanton says accessory structures greater than 200 square feet require a permit submitted with a plat or survey showing the proposed location.",
      "The city's published minimum setbacks for a residential accessory building are 25 feet from the front property line and 5 feet from side and rear property lines.",
      "A detached one-story shed at or below 200 square feet is generally permit-exempt only when it is outside a flood zone and recorded easement; other rules can still apply.",
    ],
    permitNotes: [
      {
        label: "City of Pleasanton residential permit FAQ",
        text: "The official FAQ covers accessory-structure permits, the 200-square-foot threshold, required site information, and published setbacks.",
        href: "https://www.pleasantontx.gov/departments/community_development_services/frequently_asked_questions.php",
      },
      {
        label: "Atascosa County permits and forms",
        text: "For unincorporated properties, Atascosa County provides current permit and floodplain resources.",
        href: "https://co.atascosa.tx.us/permits-and-forms/",
      },
    ],
    accessNote:
      "Share the gate width, driveway and material staging area, planned pad, nearby easements or utilities, and the route materials will take through the yard.",
    schedulingNote:
      "Permit-sensitive projects should have the site plan and placement confirmed before materials and build timing are finalized.",
    nearbySlugs: ["poteet", "floresville", "lytle"],
    faqs: [
      {
        question: "Does Pleasanton require a permit for a storage shed?",
        answer:
          "The city says a permit is required for an accessory structure greater than 200 square feet. Smaller detached one-story sheds can be exempt only when the city's stated conditions are met.",
      },
      {
        question: "How close can a shed be to my Pleasanton property line?",
        answer:
          "Pleasanton's published residential accessory-building guidance lists a 25-foot minimum front setback and 5-foot minimum side and rear setbacks. Confirm the survey, zoning, easements, and property-specific rules before placement.",
      },
    ],
  },
  {
    city: "Seguin",
    slug: "seguin",
    county: "Guadalupe County",
    title: "Custom Sheds in Seguin, TX",
    description:
      "Custom sheds in Seguin for storage, workshops, lawn equipment, and backyard organization with local permit and floodplain planning.",
    intro:
      "Shed210 builds custom sheds for Seguin homeowners who want a useful layout and a straightforward on-site build. We help plan doors, storage zones, yard access, drainage, and the local review questions that can affect placement.",
    planningNotes: [
      "Seguin provides building permits and inspections through its current city portal, so verify the required application for your shed before construction.",
      "The city's floodplain guidance says even sheds and similar improvements can require floodplain permits, with stricter limits in a floodway.",
      "Subdivision restrictions, setbacks, recorded easements, drainage, and visibility from the street can influence the final footprint and exterior choices.",
    ],
    permitNotes: [
      {
        label: "City of Seguin permits and inspections",
        text: "The official city page provides the current permit portal, inspection contacts, and application resources.",
        href: "https://www.seguintexas.gov/554/Permits-and-Inspections",
      },
      {
        label: "Seguin floodplain development guidance",
        text: "The city explains that sheds, barns, and other improvements can require permits when they are in a regulated floodplain.",
        href: "https://seguintexas.gov/DocumentCenter/View/7397",
      },
    ],
    accessNote:
      "Send photos of the driveway-to-pad route, gate measurements, drainage direction, nearby trees and utilities, and any tight turns around the home.",
    schedulingNote:
      "Confirm permit, HOA, and floodplain questions before the design is released for scheduling.",
    nearbySlugs: [
      "new-braunfels",
      "cibolo",
      "schertz",
      "marion",
      "luling",
      "nixon",
      "hallettsville",
    ],
    faqs: [
      {
        question: "Do I need a permit for a shed in Seguin?",
        answer:
          "Permit requirements depend on the structure and property. Use the city's current permit portal or contact Building Inspections before construction rather than relying on an older size exemption.",
      },
      {
        question: "Can a shed be built in a Seguin floodplain?",
        answer:
          "Floodplain projects require property-specific review, and floodway limits are stricter. Confirm the mapped flood status and permit path with the city before choosing placement.",
      },
    ],
  },
  {
    city: "Bulverde",
    slug: "bulverde",
    county: "Comal County",
    title: "Custom Sheds in Bulverde, TX",
    description:
      "Custom sheds in Bulverde for Hill Country storage, workshops, acreage, and backyard organization with drainage and tree planning.",
    intro:
      "Shed210 builds custom sheds for Bulverde properties where terrain, drainage, trees, access, and neighborhood standards can matter as much as the floor plan. We help turn those site conditions into a practical build plan.",
    planningNotes: [
      "Bulverde's building guidance separates drainage review by impervious cover, with Tier 1 analysis below 2,000 square feet and a professional-engineer-sealed Tier 2 analysis above that threshold.",
      "Tree removal within the city limits or ETJ can require a permit, subject to the city's stated exceptions.",
      "The city's residential application calls for plot and easement information, applicable flood documentation, drainage review, and HOA or POA coordination.",
    ],
    permitNotes: [
      {
        label: "City of Bulverde building review and inspection",
        text: "The official page summarizes drainage-analysis tiers, tree review, inspections, and development requirements.",
        href: "https://www.bulverdetx.gov/174/Building-Review-Inspection",
      },
      {
        label: "Comal County permits",
        text: "For unincorporated Comal County properties, the county provides current permit, floodplain, septic, and development resources.",
        href: "https://www.comalcounty.gov/286/Permits",
      },
    ],
    accessNote:
      "Share driveway slope and surface, material-route distance, gates, mature trees, low branches, rock, drainage paths, and photos of the proposed pad from several angles.",
    schedulingNote:
      "Drainage, tree, floodplain, HOA, and jurisdiction questions should be settled before the build date is confirmed.",
    nearbySlugs: ["san-antonio", "boerne", "new-braunfels"],
    faqs: [
      {
        question: "What site details matter most for a Bulverde shed?",
        answer:
          "Slope, drainage, impervious cover, mature trees, rock, driveway access, easements, and HOA or POA standards are the most useful details to check before finalizing placement.",
      },
      {
        question: "Do Bulverde shed projects need drainage or tree review?",
        answer:
          "They can. The city publishes drainage-analysis requirements and tree-permit rules for projects in its jurisdiction. Confirm which reviews apply to your address and scope before construction.",
      },
    ],
  },
  {
    city: "Lakehills",
    slug: "lakehills",
    county: "Bandera County",
    title: "Custom Sheds in Lakehills, TX",
    description:
      "Custom sheds in Lakehills for storage, workshops, tools, and Hill Country properties with careful access, drainage, and placement planning.",
    intro:
      "Shed210 plans custom shed projects for Lakehills properties with attention to the storage layout, driveway-to-pad route, grade, drainage, and local review questions. Confirming the exact address and site conditions before scheduling keeps the quote tied to the real build location.",
    planningNotes: [
      "Bandera County's development permit application asks for a 911 site address, property-location details, an area map or survey, a deed copy, and a description of the proposed development.",
      "The county application includes a property-specific flood-hazard and floodway review. Additional plans or engineering documentation can be required when proposed work lies in a mapped hazard area.",
      "Deed restrictions, subdivision rules, easements, utilities, septic components, drainage, and the material access route should all be checked before choosing the final shed location.",
    ],
    permitNotes: [
      {
        label: "Bandera County development permit application",
        text: "The county's current application shows the site information it reviews and the additional documentation that can apply in a flood-hazard area or floodway.",
        href: "https://www.banderacounty.gov/page/open/1169/0/Development%20Permit%20Application---Revised%201-8-25.pdf",
      },
    ],
    accessNote:
      "Share driveway and gate measurements, tight turns, slopes, low branches, soft ground, utilities, septic components, and photos of the full route from the crew's parking point to the proposed pad.",
    schedulingNote:
      "Confirm service availability by address and resolve access, drainage, deed-restriction, and floodplain questions before setting the build date.",
    nearbySlugs: ["san-antonio", "castroville", "boerne", "rio-medina", "shady-oaks"],
    faqs: [
      {
        question: "Does a Lakehills shed need Bandera County review?",
        answer:
          "The answer depends on the property and project. Bandera County's development application includes residential work and a flood-hazard review, so confirm the current requirements for the exact address and shed scope before construction.",
      },
      {
        question: "What should I send for a Lakehills shed quote?",
        answer:
          "Send the preferred size and use, driveway and gate details, placement photos, and any survey, easement, septic, deed-restriction, or floodplain information you already have.",
      },
    ],
  },
  {
    city: "Natalia",
    slug: "natalia",
    county: "Medina County",
    title: "Custom Sheds in Natalia, TX",
    description:
      "Custom sheds in Natalia for storage, equipment, workshops, and backyard organization with city approval, setback, and access planning.",
    intro:
      "Shed210 builds custom sheds for Natalia homes and nearby Medina County properties. We plan the footprint, doors, finish, material route, and local approval questions around the exact address before the build is scheduled.",
    planningNotes: [
      "Natalia's code-compliance guidance says a storage building should not be placed without prior approval and that zoning and setback requirements apply.",
      "The city's building-code page directs people planning construction to contact the City and identifies plans, setbacks, and inspections as part of the review process.",
      "City limits, subdivision restrictions, easements, septic components, and the 35-mile distance calculation should be checked separately for the build address.",
    ],
    permitNotes: [
      {
        label: "City of Natalia building codes",
        text: "The City's official page explains its construction-contact, plan-review, setback, and inspection process.",
        href: "https://cityofnatalia.squarespace.com/building-codes",
      },
      {
        label: "Natalia code compliance",
        text: "The City's code-compliance page specifically cautions against placing a storage building before approval and notes that zoning and setbacks apply.",
        href: "https://cityofnatalia.squarespace.com/code-compliance",
      },
    ],
    accessNote:
      "Send the gate width, driveway-to-pad route, material staging space, proposed placement, drainage direction, and photos showing fences, utilities, trees, and septic features.",
    schedulingNote:
      "Confirm the address, City approval path, site access, and final placement before materials are released for the build.",
    nearbySlugs: ["lytle", "castroville", "rio-medina"],
    faqs: [
      {
        question: "Does Natalia require approval for a storage shed?",
        answer:
          "Natalia's official code-compliance page says storage buildings should not be placed without prior approval and that zoning and setback requirements apply. Confirm the current, property-specific process with the City before construction.",
      },
      {
        question: "What should I send for a Natalia shed quote?",
        answer:
          "Send the preferred size and use, placement and access photos, gate measurements, and any survey, easement, HOA, or City guidance you already have.",
      },
    ],
  },
  {
    city: "Karnes City",
    slug: "karnes-city",
    county: "Karnes County",
    title: "Custom Sheds in Karnes City, TX",
    description:
      "Custom sheds and water-well shelters in Karnes City with site-plan, anchoring, access, floodplain, and travel planning.",
    intro:
      "Shed210 builds storage sheds, equipment shelters, and water-well enclosures for Karnes City and nearby Karnes County properties. The best plan starts with the exact site, access route, structure use, and any future service-clearance needs.",
    deliveryCoverage: {
      heading: "Karnes City service and scheduling",
      description:
        "Karnes City is beyond Shed210's current 35-mile no-distance-fee area. Service and any distance charge are confirmed from the build address before scheduling.",
      details: [
        "A completed local project confirms Karnes City is an active service area, but city listing alone does not waive distance fees.",
        "Driveway condition, material staging room, gates, soft ground, and the distance from crew parking to the pad affect the build plan.",
        "For well shelters, identify pipes, electrical equipment, roof-removal clearance, drainage, and anchoring needs before finalizing the design.",
      ],
    },
    planningNotes: [
      "Karnes City's building-permit page asks applicants to verify the legal description and submit a site plan showing existing and proposed structures plus distances to lot lines.",
      "The City says it does not have a zoning ordinance regulating residential or commercial land use, but building permits, adopted codes, floodplain review, deed restrictions, and utility constraints can still apply.",
      "Properties outside city limits follow Karnes County processes, including its development-permit and floodplain resources.",
    ],
    permitNotes: [
      {
        label: "Karnes City building permits",
        text: "The City's official page explains permit intake, legal-description verification, site-plan details, inspections, and current code contacts.",
        href: "https://cityofkctx.com/building-permits/",
      },
      {
        label: "Karnes County permits",
        text: "The County provides development-permit, floodplain, septic, driveway, and related property resources for addresses outside city limits.",
        href: "https://www.co.karnes.tx.us/page/karnes.permits",
      },
    ],
    accessNote:
      "Share the driveway surface, gate and turn measurements, crew parking and material staging area, slope, drainage, utilities, well equipment, and photos from the road to the proposed pad.",
    schedulingNote:
      "Confirm jurisdiction, travel, access, anchoring, and any permit or floodplain review before the crew and materials are scheduled.",
    nearbySlugs: [
      "floresville",
      "nixon",
      "pleasanton",
      "hallettsville",
      "yorktown",
    ],
    faqs: [
      {
        question: "What does Karnes City ask for on a shed site plan?",
        answer:
          "The City's permit page calls for existing and proposed structures and their distances from lot lines, along with legal-description verification. Ask the building official which current documents apply to your exact project.",
      },
      {
        question: "Can Shed210 plan a removable roof for a Karnes City well shelter?",
        answer:
          "Yes. Tell us how the well and equipment may need to be serviced so roof access, clearances, anchoring, insulation, and door placement can be included in the quote.",
      },
    ],
  },
  {
    city: "Hallettsville",
    slug: "hallettsville",
    county: "Lavaca County",
    title: "Custom Sheds in Hallettsville, TX",
    description:
      "Custom sheds and large pet shelters in Hallettsville with site-plan, floodplain, access, and long-distance scheduling guidance.",
    intro:
      "Shed210 serves Hallettsville with custom storage buildings, utility spaces, and purpose-built animal shelters. We confirm travel, access, placement, and the local permit path from the exact address before setting a build date.",
    deliveryCoverage: {
      heading: "Hallettsville service and scheduling",
      description:
        "Hallettsville is beyond Shed210's current 35-mile no-distance-fee area. The build address is reviewed for service availability, travel pricing, and scheduling before the project is confirmed.",
      details: [
        "A completed Hallettsville build provides local project proof without publishing the customer's street address.",
        "Longer-distance jobs need dependable material staging space, an accessible route to the pad, and a weather-ready site.",
        "Animal shelters should be planned around ventilation, cleanout access, door placement, shade, drainage, and the intended occupants.",
      ],
    },
    planningNotes: [
      "Hallettsville routes building permits through its official permit portal and publishes floodplain resources for property-specific review.",
      "The City's accessory-building checklist calls for an application, project use and size, site plan, setbacks, existing structures, plan set, and foundation information when applicable.",
      "The Facebook source used the spelling “Halletsville”; the canonical city and service-area spelling is “Hallettsville.”",
    ],
    permitNotes: [
      {
        label: "City of Hallettsville permits",
        text: "The official permits page links the City's building-permit portal and current floodplain resources.",
        href: "https://cityofhallettsville.org/permits/",
      },
      {
        label: "Accessory-building submittal checklist",
        text: "The City's published project checklist identifies the site-plan, setback, plan-set, use, size, and foundation information used for accessory-building review.",
        href: "https://cityofhallettsville.org/wp-content/uploads/2025/08/BV-Required-Documents-by-Project-Type.pdf",
      },
    ],
    accessNote:
      "Send driveway and gate measurements, material staging space, the full route to the pad, drainage and shade conditions, nearby utilities, and several placement photos.",
    schedulingNote:
      "Travel, access, City review, floodplain questions, and the final animal-shelter or storage layout should be settled before scheduling.",
    nearbySlugs: ["karnes-city", "yorktown", "seguin", "luling"],
    faqs: [
      {
        question: "What does Hallettsville request for an accessory-building permit?",
        answer:
          "The City's published checklist identifies a permit application, project use and size, site plan with setbacks and existing structures, plan set, and foundation details when applicable. Confirm the current checklist for your scope.",
      },
      {
        question: "Can Shed210 customize a Hallettsville dog house or animal shelter?",
        answer:
          "Yes. Share the number and size of animals plus your ventilation, insulation, door, cleaning, shade, and drainage needs so the enclosure is planned for its real use.",
      },
    ],
  },
  {
    city: "Helotes",
    slug: "helotes",
    contentLastModified: "2026-09-22",
    county: "Bexar County",
    title: "Custom Sheds in Helotes, TX",
    description:
      "Custom sheds in Helotes with reinforced floors, ramps, access planning, and city or HOA review for Northwest Bexar County properties.",
    intro:
      "Shed210 builds custom storage sheds and utility buildings for Helotes homes and nearby Northwest Bexar County properties. We plan the footprint, ramp, doors, floor capacity, access route, and exterior finish around the yard and its approval requirements.",
    relatedGuides: [
      {
        href: "/news/san-antonio-shed-cost-guide",
        title: "Plan the footprint and compare the complete quote",
        description:
          "Use the 8x10 versus 10x12 comparison and scope checklist before pricing your options. Helotes jurisdiction and approval questions are checked separately from San Antonio rules.",
      },
    ],
    planningNotes: [
      "Helotes Development Services oversees zoning, permitting, inspections, certificates of occupancy, and related development review inside the City's jurisdiction.",
      "A detached accessory structure can require property-specific survey, setback, easement, foundation, or inspection documentation depending on size and scope.",
      "Old Town, HOA, utility, floodplain, and city-limit boundaries can add separate design or placement requirements, so confirm the exact property jurisdiction.",
    ],
    permitNotes: [
      {
        label: "City of Helotes Development Services",
        text: "The official department page provides the current planning, zoning, permitting, inspection, and development contacts.",
        href: "https://helotes-tx.gov/departments/development-services/",
      },
    ],
    accessNote:
      "Measure the narrowest gate and turns, identify slopes and drainage, show the material route, and note what equipment will use the ramp or reinforced floor.",
    schedulingNote:
      "Confirm the address jurisdiction, HOA or Old Town review, access route, floor and ramp requirements, and site readiness before build day.",
    nearbySlugs: ["san-antonio", "lakehills", "rio-medina"],
    faqs: [
      {
        question: "Who reviews shed permits in Helotes?",
        answer:
          "Helotes Development Services handles City planning, zoning, permitting, and inspections. Contact the department with the exact address, dimensions, placement, foundation, and utility scope for current guidance.",
      },
      {
        question: "Can a Helotes shed have a reinforced floor and heavy-duty ramp?",
        answer:
          "Yes. Tell us the weight and dimensions of the mower, equipment, or stored items so the floor, door opening, ramp, and approach can be planned together.",
      },
      {
        question: "What should I confirm after getting an instant price?",
        answer:
          "Check that the dimensions, wall height, doors, floor requirements, and upgrades match your intended use. The result is an estimated build subtotal; travel, site work, and any separately priced requested items need confirmation before a final quote or scheduling.",
      },
    ],
  },
  {
    city: "Shady Oaks",
    slug: "shady-oaks",
    county: "Kendall County (Comfort area)",
    title: "Custom Sheds in Shady Oaks, TX",
    description:
      "Custom sheds in the Shady Oaks service area with conservative address verification, development-permit, access, drainage, and deed-restriction planning.",
    intro:
      "Shed210 has completed a custom barn-style structure identified by the customer-facing project source as Shady Oaks, Texas. Because Shady Oaks is a subdivision and neighborhood name used in more than one Texas jurisdiction, we confirm the exact build address before applying permit, service-area, or scheduling guidance.",
    deliveryCoverage: {
      heading: "Shady Oaks service and jurisdiction check",
      description:
        "This service-area page uses the Comfort-area Shady Oaks location in Kendall County. That location is beyond the current 35-mile no-distance-fee area, so the exact address controls jurisdiction, service availability, and any travel charge.",
      details: [
        "The published project remains customer-safe: it identifies Shady Oaks only and does not expose a street address.",
        "If the address is a different Shady Oaks community or falls inside another city, the applicable permit authority and public project city should be corrected before scheduling.",
        "For Comfort-area properties, driveway access, dark-sky lighting, septic or well features, drainage, floodplain status, and deed restrictions can affect placement.",
      ],
    },
    planningNotes: [
      "Kendall County says a 911 rural address and applicable access permit come before its development, septic, or well permit process.",
      "The County says a development permit is required for property development and lists outdoor-lighting, floodplain, septic, driveway, and recorded deed-restriction considerations.",
      "Barn-style height, windows, doors, insulation, pad drainage, access, and subdivision restrictions should be reviewed together before the final location is approved.",
    ],
    permitNotes: [
      {
        label: "Kendall County development information",
        text: "The County's official page explains the address, access, development-permit, lighting, septic, well, and recorded-restriction sequence.",
        href: "https://www.kendallcountytx.gov/392/Development-Information",
      },
      {
        label: "Kendall County forms and permits",
        text: "The official forms directory provides current development, address, access, dark-sky, septic, floodplain, and right-of-way documents.",
        href: "https://www.kendallcountytx.gov/252/Forms-Permits",
      },
    ],
    accessNote:
      "Send the exact city and county jurisdiction privately, then share driveway and gate measurements, material-route distance, slope, drainage, utilities, septic or well features, trees, and pad photos.",
    schedulingNote:
      "Verify which Shady Oaks location the address belongs to, then confirm travel, County or City approvals, deed restrictions, and site access before scheduling.",
    nearbySlugs: ["boerne", "lakehills", "helotes"],
    faqs: [
      {
        question: "Which Shady Oaks does this service-area page cover?",
        answer:
          "It is configured for the Comfort-area Shady Oaks location in Kendall County because that is the regional match for this Shed210 project source. Confirm the exact address privately; another Shady Oaks community may have a different permit authority.",
      },
      {
        question: "Does Kendall County require a development permit for a shed?",
        answer:
          "Kendall County's official development page says a development permit is required for property development and describes prerequisite address and access steps. Ask the County which documents apply to the exact structure and property.",
      },
    ],
  },
  {
    city: "Converse",
    slug: "converse",
    county: "Bexar County",
    title: "Custom Sheds in Converse, TX",
    description:
      "Custom sheds and insulated pet shelters in Converse with permit, setback, easement, height, and access planning.",
    intro:
      "Shed210 builds custom storage buildings and insulated pet shelters for Converse properties. We plan doors, ventilation, insulation, placement, access, and any slab or utility work around the exact use and the City's current requirements.",
    planningNotes: [
      "Converse's current zoning code requires a building permit for an accessory structure and limits it to one story and 12 feet in height.",
      "The same code requires at least five feet from front and rear property lines and prohibits placement in an easement without written permission from the easement holder.",
      "Insulated animal shelters need deliberate ventilation, shade, drainage, cleanout access, door layout, and safe clearances around any electrical equipment.",
    ],
    permitNotes: [
      {
        label: "Converse accessory-structure code",
        text: "The current City code covers the building-permit requirement, setbacks, easements, and height limit for accessory structures.",
        href: "https://library.municode.com/tx/converse/codes/code_of_ordinances?nodeId=PTIICOOR_CH50ZO_ARTIVDIDIRE_DIV10LEDI",
      },
      {
        label: "City of Converse permit portal",
        text: "Use the City's current permit portal to confirm and submit the property-specific building application.",
        href: "https://ci-converse-tx.smartgovcommunity.com/",
      },
    ],
    accessNote:
      "Send gate and side-yard measurements, turns around the home, drainage, utility and easement locations, slab or pad details, and photos of the intended placement.",
    schedulingNote:
      "Confirm the City permit, any flatwork or utility review, HOA requirements, placement, and access before the build date is set.",
    nearbySlugs: ["universal-city", "schertz", "san-antonio"],
    faqs: [
      {
        question: "Does a small shed need a permit in Converse?",
        answer:
          "Converse's current zoning code requires a building permit for an accessory structure. Confirm the application, foundation or utility scope, and property-specific constraints through the City's permit portal before construction.",
      },
      {
        question: "Can Shed210 insulate a Converse dog house?",
        answer:
          "Yes. We can plan insulation with the enclosure size, ventilation, doors, windows, shade, drainage, and cleanout access rather than treating insulation as a stand-alone option.",
      },
    ],
  },
  {
    city: "Rio Medina",
    slug: "rio-medina",
    county: "Medina County",
    title: "Custom Sheds in Rio Medina, TX",
    description:
      "Custom sheds and mobile-office structures in Rio Medina with Medina County floodplain, septic, driveway, utility, access, and travel planning.",
    intro:
      "Shed210 serves Rio Medina and surrounding Medina County properties with custom sheds, workshops, and larger office-style structures. Acreage access, utilities, drainage, foundation scope, and the intended use should be defined before a large build is quoted or scheduled.",
    planningNotes: [
      "Rio Medina is unincorporated, so Medina County and other applicable authorities—not a Rio Medina city building department—handle property-specific development questions.",
      "Medina County's permit guide identifies 911 addressing, floodplain development review, on-site sewage, and driveway or utility permits as possible requirements depending on the property and work.",
      "A large office-style structure can involve foundation, electrical, plumbing, accessibility, engineering, or occupancy questions beyond a standard storage shed.",
    ],
    permitNotes: [
      {
        label: "Medina County permits-needed guide",
        text: "The County's official guide identifies 911 address, floodplain development, septic, driveway, and utility permit contacts for unincorporated properties.",
        href: "https://www.medinacountytexas.org/upload/page/6808/docs/Permits%20needed.pdf",
      },
      {
        label: "Medina County subdivision rules",
        text: "The current County rules provide the broader floodplain, wastewater, drainage, road, and unincorporated-development framework.",
        href: "https://www.medinacountytexas.org/upload/page/6822/docs/Rules%20-%20Regulations%202024.pdf",
      },
    ],
    accessNote:
      "For a larger build, send road and driveway conditions, crew parking and material staging space, gate widths, overhead clearances, route distance, slope, drainage, utilities, septic, and foundation photos or plans.",
    schedulingNote:
      "Confirm intended use, County and trade requirements, foundation and utility scope, access, travel, and site readiness before scheduling a large structure.",
    nearbySlugs: ["castroville", "natalia", "lakehills"],
    faqs: [
      {
        question: "Who handles permits in Rio Medina?",
        answer:
          "Rio Medina is unincorporated. Medina County's official permit guide identifies the County and other authorities involved in addressing, floodplain, septic, driveway, and utility work. Requirements depend on the address and scope.",
      },
      {
        question: "Can Shed210 build a large office in Rio Medina?",
        answer:
          "Shed210 has completed a large local office project, but the intended occupancy, foundation, utilities, access, engineering, and approval path must be confirmed before treating an office like a standard storage shed.",
      },
    ],
  },
  {
    city: "Marion",
    slug: "marion",
    county: "Guadalupe County",
    title: "Custom Sheds in Marion, TX",
    description:
      "Custom sheds in Marion with City plan review, contractor, inspection, placement, access, and repeat-customer project proof.",
    intro:
      "Shed210 builds custom storage sheds for Marion homes and nearby Guadalupe County properties. We confirm the building size, door and ramp layout, site access, placement, and City or county jurisdiction before scheduling.",
    planningNotes: [
      "Marion's building requirements say plans and permit documents must be approved before the permit is issued and work begins.",
      "The City requires contractors working in its jurisdiction to register and provide current liability insurance, and its permits require a final inspection.",
      "Addresses outside city limits can follow a separate Guadalupe County, floodplain, utility, subdivision, or deed-restriction path.",
    ],
    permitNotes: [
      {
        label: "City of Marion building requirements",
        text: "The City's official guide covers adopted codes, permit approval before work, plan review, contractor registration, inspections, and permit timing.",
        href: "https://www.cityofmariontx.org/Document%20Center/Planning%20and%20Zoning/building_requirements.pdf",
      },
    ],
    accessNote:
      "Share the driveway-to-pad route, gate and turn measurements, crew parking and material staging area, drainage, utilities and easements, existing structures, and placement photos.",
    schedulingNote:
      "Confirm city limits, plan review, contractor requirements, final placement, access, and site readiness before construction is scheduled.",
    nearbySlugs: ["cibolo", "schertz", "seguin"],
    faqs: [
      {
        question: "Does Marion require permit approval before shed work starts?",
        answer:
          "The City's building-requirements guide says applicable plans and documents must be approved and the permit picked up before work begins. Confirm which current permit category applies to your structure.",
      },
      {
        question: "What should a repeat Marion customer send for another shed?",
        answer:
          "Send the new size and use, updated placement and access photos, and any changes to gates, drainage, utilities, easements, HOA rules, or City guidance since the earlier build.",
      },
    ],
  },
  {
    city: "Luling",
    slug: "luling",
    county: "Caldwell and Guadalupe Counties",
    title: "Custom Sheds in Luling, TX",
    description:
      "Custom sheds in Luling with City permit, zoning, floodplain, access, travel, and long-distance scheduling guidance.",
    intro:
      "Shed210 serves Luling and nearby Caldwell and Guadalupe County properties with custom storage sheds, workshops, and backyard utility buildings. We confirm the build address, travel, placement, access, and local review path before scheduling.",
    deliveryCoverage: {
      heading: "Luling service and scheduling",
      description:
        "Luling is beyond Shed210's current 35-mile no-distance-fee area. The build address is reviewed for service availability, travel pricing, and scheduling before the project is confirmed.",
      details: [
        "Longer-distance jobs need dependable crew parking, material staging space, and an accessible route from the driveway to the pad.",
        "City limits, county boundaries, floodplain status, easements, and utility locations can change the approval or placement path for an individual property.",
        "Site photos and accurate measurements help settle travel, access, placement, and build-day questions before materials are scheduled.",
      ],
    },
    planningNotes: [
      "Luling's current permits page says permits and inspections cover structural work and storage buildings, and directs construction documents to the City's Permit Clerk for plan review.",
      "The City's residential checklist identifies accessory structures such as sheds and calls for the proposed use, zoning approval, a dimensioned site plan, foundation or anchoring details, elevations, and a roof plan.",
      "Luling's Planning and Code Enforcement Department handles floodplain development review, so the exact property should be checked before placement is finalized.",
    ],
    permitNotes: [
      {
        label: "City of Luling permits and inspections",
        text: "The official City page provides the current permit process, application materials, inspection guidance, and Permit Clerk contact information.",
        href: "https://www.cityofluling.net/296/Permits-Applications-Inspections",
      },
      {
        label: "Luling residential accessory-structure checklist",
        text: "The City's residential review checklist lists the site-plan, zoning, foundation or anchoring, elevation, and roof information requested for sheds and other accessory structures.",
        href: "https://www.cityofluling.net/DocumentCenter/View/1089/NEW-ALTERATION-RESIDENTAL--PERMIT-PACKET",
      },
      {
        label: "Luling floodplain development review",
        text: "The City's development-permit exemption form shows that proposed construction is reviewed for the 100-year floodplain before a floodplain exemption is issued.",
        href: "https://www.cityofluling.net/DocumentCenter/View/1562/Development-Permit-Exemption_PDF",
      },
    ],
    accessNote:
      "Send the driveway and gate widths, crew parking and material staging area, full route to the pad, nearby structures, trees, utilities and easements, drainage conditions, and several placement photos.",
    schedulingNote:
      "Confirm service availability, travel pricing, zoning, permit and floodplain review, access, and final placement before the crew and materials are scheduled.",
    nearbySlugs: [
      "seguin",
      "nixon",
      "new-braunfels",
      "hallettsville",
      "karnes-city",
    ],
    faqs: [
      {
        question: "Does Luling require a permit for a storage shed?",
        answer:
          "The City's current permit page includes storage buildings among the projects covered by its construction permit application. Confirm the current submittal and inspection path with the Permit Clerk before work begins.",
      },
      {
        question: "What does Luling request for an accessory-structure review?",
        answer:
          "The City's residential checklist identifies the proposed use, zoning approval, a dimensioned site plan showing structures, easements, setbacks and property lines, foundation or anchoring details, elevations, and a roof plan.",
      },
    ],
  },
  {
    city: "Yorktown",
    slug: "yorktown",
    county: "DeWitt County",
    title: "Custom Sheds in Yorktown, TX",
    description:
      "Custom sheds in Yorktown with City permit, floodplain, access, travel, and long-distance scheduling guidance.",
    intro:
      "Shed210 serves Yorktown and nearby DeWitt County properties with custom storage sheds, workshops, equipment shelters, and backyard utility buildings. We confirm the build address, jurisdiction, travel, placement, access, and local review path before scheduling.",
    deliveryCoverage: {
      heading: "Yorktown service and scheduling",
      description:
        "Yorktown is beyond Shed210's current 35-mile no-distance-fee area. The build address is reviewed for service availability, travel pricing, and scheduling before the project is confirmed.",
      details: [
        "Longer-distance jobs need dependable crew parking, material staging space, and an accessible route from the driveway to the pad.",
        "City limits, floodplain status, easements, utilities, septic components, and deed restrictions can change the approval or placement path for an individual property.",
        "Site photos and accurate measurements help settle travel, access, placement, and build-day questions before materials are scheduled.",
      ],
    },
    planningNotes: [
      "Yorktown's current code adopts the 2018 International Building Code and 2018 International Residential Code, with local permit-fee and enforcement provisions administered by the City.",
      "The City's contact directory identifies a Water/Utility/Permits Director at City Hall. Confirm the exact shed size, scope, documents, fee, and inspection path before work begins.",
      "Yorktown's flood-damage ordinance requires development permits in mapped special flood hazard areas and describes scaled plans showing proposed work, structures, dimensions, and elevations.",
      "For an address outside city limits, DeWitt County publishes separate floodplain-development and onsite-sewage permit resources.",
    ],
    permitNotes: [
      {
        label: "City of Yorktown building code and permits",
        text: "The City's adopted building-code provisions cover permit issuance, fees, approved construction documents, and enforcement for work that requires a permit.",
        href: "https://ecode360.com/46181976",
      },
      {
        label: "Yorktown City permits contact",
        text: "The official City contact directory lists the Water/Utility/Permits Director, City Hall address, and main phone number for current project-specific guidance.",
        href: "https://www.yorktowntx.com/contact-directory/",
      },
      {
        label: "Yorktown floodplain development review",
        text: "The City's flood-damage ordinance identifies when a development permit is required and the site information used for floodplain review.",
        href: "https://ecode360.com/41559128",
      },
      {
        label: "DeWitt County permit resources",
        text: "The County provides floodplain-development and onsite-sewage resources for properties under county jurisdiction.",
        href: "https://www.co.dewitt.tx.us/page/dewitt.permits",
      },
    ],
    accessNote:
      "Send the driveway and gate widths, crew parking and material staging area, full route to the pad, nearby structures, trees, utilities, septic features, drainage conditions, and several placement photos.",
    schedulingNote:
      "Confirm service availability, travel pricing, jurisdiction, permit and floodplain review, access, and final placement before the crew and materials are scheduled.",
    nearbySlugs: [
      "nixon",
      "karnes-city",
      "hallettsville",
      "luling",
      "floresville",
    ],
    faqs: [
      {
        question: "Does Yorktown require a building permit for a shed?",
        answer:
          "Yorktown's code says work for which a building permit is required must not start before the permit is obtained. Because the exact path can depend on the structure's size, utilities, location, and scope, confirm the current requirements with the City's permits contact before scheduling.",
      },
      {
        question: "What if a Yorktown-area property is outside city limits or in a floodplain?",
        answer:
          "Confirm the jurisdiction from the exact address. The City administers floodplain review inside its jurisdiction, while DeWitt County publishes separate floodplain development and septic resources for county properties.",
      },
    ],
  },
  {
    city: "Nixon",
    slug: "nixon",
    county: "Gonzales and Wilson Counties",
    title: "Custom Sheds in Nixon, TX",
    description:
      "Custom sheds in Nixon with City construction-permit, two-county jurisdiction, access, floodplain, and travel planning.",
    intro:
      "Shed210 serves Nixon and nearby properties in Gonzales and Wilson Counties with custom storage sheds, workshops, equipment shelters, and backyard utility buildings. We confirm the build address, jurisdiction, travel, placement, access, and local review path before scheduling.",
    deliveryCoverage: {
      heading: "Nixon service and scheduling",
      description:
        "Nixon is beyond Shed210's current 35-mile no-distance-fee area. The build address is reviewed for service availability, travel pricing, and scheduling before the project is confirmed.",
      details: [
        "Longer-distance jobs need dependable crew parking, material staging space, and an accessible route from the driveway to the pad.",
        "Nixon spans Gonzales and Wilson Counties, so city limits, county jurisdiction, floodplain status, easements, utilities, septic components, and deed restrictions can affect the approval or placement path.",
        "Site photos and accurate measurements help settle travel, access, placement, and build-day questions before materials are scheduled.",
      ],
    },
    planningNotes: [
      "City of Nixon Code Compliance publishes a construction application and directs permit requests to its office. The application asks for the project address, type, cost, square footage, description, and drawings or measurements for other project types.",
      "The City identifies Nixon as being in Gonzales and Wilson Counties. Confirm whether the exact build address is inside city limits and which county has jurisdiction before relying on a permit path.",
      "For applicable unincorporated Gonzales County properties, the County permit office publishes floodplain, septic, driveway, and subdivision resources.",
      "For applicable unincorporated Wilson County properties, the County permitting office covers development, floodplain, driveway, septic, and related property review.",
    ],
    permitNotes: [
      {
        label: "City of Nixon construction permits",
        text: "The City's Code Compliance page provides the current construction-application link and contact information for project-specific guidance.",
        href: "https://nixon.texas.gov/code-compliance-dept",
      },
      {
        label: "Nixon construction application",
        text: "The City's application requests the project address, scope, cost, square footage, description, and supporting drawings or measurements where applicable.",
        href: "https://img1.wsimg.com/blobby/go/c49c248f-f1cc-4805-a619-d8529d281841/downloads/7ac65f0f-e6dc-4765-baa5-4eca224dde01/Construction%20Application.pdf",
      },
      {
        label: "Gonzales County permit resources",
        text: "The County provides floodplain, septic, driveway, and subdivision resources for properties under its jurisdiction.",
        href: "https://www.co.gonzales.tx.us/page/gonzales.County.Permits",
      },
      {
        label: "Wilson County permitting and development",
        text: "The County provides development, floodplain, driveway, septic, and related guidance for applicable unincorporated properties.",
        href: "https://www.wilsoncountytx.gov/page/wilson.PermittingDevelopment",
      },
    ],
    accessNote:
      "Send the driveway and gate widths, crew parking and material staging area, full route to the pad, nearby structures, trees, utilities, septic features, drainage conditions, and several placement photos.",
    schedulingNote:
      "Confirm service availability, travel pricing, city and county jurisdiction, permit and floodplain review, access, and final placement before the crew and materials are scheduled.",
    nearbySlugs: [
      "seguin",
      "yorktown",
      "floresville",
      "karnes-city",
      "luling",
    ],
    faqs: [
      {
        question: "What does Nixon ask for with a shed permit?",
        answer:
          "The City's construction application asks for the project address, type, cost, square footage, description, and supporting drawings or measurements where applicable. Confirm the current, property-specific requirements with Code Compliance before scheduling.",
      },
      {
        question: "What if a Nixon-area property is outside city limits?",
        answer:
          "Confirm the jurisdiction from the exact address because Nixon spans Gonzales and Wilson Counties. For an unincorporated property, review the applicable county's development, floodplain, driveway, septic, subdivision, and deed-restriction requirements before construction.",
      },
    ],
  },
] as const satisfies readonly ServiceArea[];

export function getServiceArea(slug: string): ServiceArea | undefined {
  return SERVICE_AREAS.find((area) => area.slug === slug);
}
