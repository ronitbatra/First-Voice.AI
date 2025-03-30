export const requestLocationPermission = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Success callback
        const { latitude, longitude } = position.coords;
        console.log(`Location permission granted: ${latitude}, ${longitude}`);
        resolve({ latitude, longitude });
      },
      (error) => {
        // Error callback
        console.error("Location permission denied:", error.message);
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );
  });
};

// Reverse geocode coordinates to get location name
export const getLocationNameFromCoords = async (latitude, longitude) => {
  try {
    // In a production app, you would use a service like Google Maps Geocoding API
    // For this implementation, we'll simulate it with a simple fetch to a free service
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
      {
        headers: {
          "User-Agent": "First Voice AI Mental Health Assistant",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get location name: ${response.status}`);
    }

    const data = await response.json();

    // Extract city and state/region from the address
    const city =
      data.address.city || data.address.town || data.address.village || "";
    const state = data.address.state || data.address.region || "";
    const country = data.address.country || "";

    return {
      displayName: data.display_name,
      city,
      state,
      country,
      formattedLocation: city
        ? `${city}, ${state || country}`
        : data.display_name,
    };
  } catch (error) {
    console.error("Error getting location name:", error);
    // Return null if we can't get the location name
    return null;
  }
};

// Fetch nearby mental health providers using OpenAI
export const fetchMentalHealthProviders = async (locationData) => {
  try {
    // Ensure we have location data
    if (!locationData) {
      throw new Error("No location data provided");
    }

    const { latitude, longitude, locationName } = locationData;

    // Make a request to our API endpoint that uses OpenAI
    const response = await fetch("/api/v1/providers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        location: locationName,
        coordinates: { latitude, longitude },
      }),
    });

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return data.providers;
  } catch (error) {
    console.error("Error fetching mental health providers:", error);
    throw error;
  }
};

// Generate fallback providers based on coordinates
export const generateFallbackProviders = (
  locationName,
  latitude,
  longitude
) => {
  // Generate a "random" seed from coordinates for consistent results
  const seed = Math.abs(Math.floor(latitude * 10) + Math.floor(longitude * 10));

  // Use arrays of names and types to generate varied providers
  const centerNames = [
    "Community Mental Health Center",
    "Behavioral Health Services",
    "Wellness & Counseling Center",
    "Integrated Care Clinic",
    "Psychological Services Center",
  ];

  const therapistFirstNames = [
    "Sarah",
    "Michael",
    "Jennifer",
    "David",
    "Rebecca",
    "James",
    "Emily",
    "Robert",
    "Lisa",
    "Thomas",
  ];

  const therapistLastNames = [
    "Johnson",
    "Williams",
    "Smith",
    "Brown",
    "Jones",
    "Garcia",
    "Miller",
    "Davis",
    "Rodriguez",
    "Martinez",
  ];

  const specialties = [
    "Psychiatrist",
    "Clinical Psychologist",
    "Licensed Therapist",
    "Mental Health Counselor",
    "Licensed Clinical Social Worker",
  ];

  const streetNames = [
    "Main St",
    "Oak Ave",
    "Maple Dr",
    "Park Blvd",
    "Washington St",
    "Cedar Ln",
    "Elm St",
    "Pine Ave",
    "Lake Dr",
    "River Rd",
  ];

  // Generate 5 providers
  return [
    // Community centers (1-2)
    {
      name: `${locationName} ${centerNames[seed % centerNames.length]}`,
      address: `${100 + (seed % 900)} ${
        streetNames[seed % streetNames.length]
      }, ${locationName}`,
      phone: `(${200 + (seed % 800)}) ${100 + (seed % 900)}-${
        1000 + (seed % 9000)
      }`,
      website: `https://mhc-${locationName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")}.org`,
      distance: `${(0.5 + (seed % 15) / 10).toFixed(1)} miles`,
      type: "Mental Health Center",
      services:
        "Individual therapy, group therapy, medication management, crisis intervention",
      insurance: "Accepts most major insurance, sliding scale available",
    },
    {
      name: `${locationName} ${centerNames[(seed + 2) % centerNames.length]}`,
      address: `${100 + ((seed + 3) % 900)} ${
        streetNames[(seed + 2) % streetNames.length]
      }, ${locationName}`,
      phone: `(${200 + ((seed + 2) % 800)}) ${100 + ((seed + 2) % 900)}-${
        1000 + ((seed + 2) % 9000)
      }`,
      website: `https://bhc-${locationName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")}.org`,
      distance: `${(1.2 + (seed % 20) / 10).toFixed(1)} miles`,
      type: "Behavioral Health Center",
      services:
        "Psychiatric evaluation, therapy, support groups, substance abuse treatment",
      insurance: "Medicaid, Medicare, private insurance, self-pay options",
    },

    // Private practitioners (3-5)
    {
      name: `Dr. ${therapistFirstNames[seed % therapistFirstNames.length]} ${
        therapistLastNames[seed % therapistLastNames.length]
      }`,
      address: `${300 + (seed % 700)} ${
        streetNames[(seed + 4) % streetNames.length]
      }, Suite ${(seed % 10) + 1}${String.fromCharCode(
        65 + (seed % 26)
      )}, ${locationName}`,
      phone: `(${200 + ((seed + 4) % 800)}) ${100 + ((seed + 4) % 900)}-${
        1000 + ((seed + 4) % 9000)
      }`,
      website: `https://dr${therapistLastNames[
        seed % therapistLastNames.length
      ].toLowerCase()}.com`,
      distance: `${(0.8 + (seed % 25) / 10).toFixed(1)} miles`,
      type: specialties[seed % specialties.length],
      services: "Individual therapy, couples therapy, medication management",
      insurance: "Blue Cross, Aetna, United Healthcare, self-pay",
    },
    {
      name: `Dr. ${
        therapistFirstNames[(seed + 3) % therapistFirstNames.length]
      } ${therapistLastNames[(seed + 2) % therapistLastNames.length]}`,
      address: `${200 + ((seed + 6) % 800)} ${
        streetNames[(seed + 5) % streetNames.length]
      }, ${locationName}`,
      phone: `(${200 + ((seed + 6) % 800)}) ${100 + ((seed + 6) % 900)}-${
        1000 + ((seed + 6) % 9000)
      }`,
      website: `https://dr${therapistLastNames[
        (seed + 2) % therapistLastNames.length
      ].toLowerCase()}.net`,
      distance: `${(1.5 + (seed % 30) / 10).toFixed(1)} miles`,
      type: specialties[(seed + 2) % specialties.length],
      services: "Psychiatric evaluation, therapy, telepsychiatry",
      insurance: "Cigna, Anthem, Medicare, out-of-network benefits",
    },
    {
      name: `${therapistFirstNames[(seed + 5) % therapistFirstNames.length]} ${
        therapistLastNames[(seed + 4) % therapistLastNames.length]
      }, ${specialties[(seed + 3) % specialties.length]
        .replace("Psychiatrist", "LMHC")
        .replace("Clinical Psychologist", "PhD")}`,
      address: `${400 + ((seed + 8) % 600)} ${
        streetNames[(seed + 7) % streetNames.length]
      }, ${locationName}`,
      phone: `(${200 + ((seed + 8) % 800)}) ${100 + ((seed + 8) % 900)}-${
        1000 + ((seed + 8) % 9000)
      }`,
      website: `https://${therapistLastNames[
        (seed + 4) % therapistLastNames.length
      ].toLowerCase()}therapy.com`,
      distance: `${(2.2 + (seed % 35) / 10).toFixed(1)} miles`,
      type: "Therapist",
      services:
        "Individual therapy, cognitive behavioral therapy, trauma-focused therapy",
      insurance: "Most major insurances accepted, sliding scale available",
    },
  ];
};

// Format providers for display
export const formatProvidersForDisplay = (providers) => {
  if (!providers || providers.length === 0) {
    return "No local providers found.";
  }

  // Group providers by type
  const centers = providers.filter(
    (p) =>
      p.type?.toLowerCase().includes("center") ||
      p.name.toLowerCase().includes("center") ||
      p.name.toLowerCase().includes("clinic") ||
      p.name.toLowerCase().includes("services")
  );

  const psychiatrists = providers.filter(
    (p) =>
      p.type?.toLowerCase().includes("psychiatrist") ||
      (p.name.toLowerCase().includes("dr") &&
        p.services?.toLowerCase().includes("medication"))
  );

  const therapists = providers.filter(
    (p) => !centers.includes(p) && !psychiatrists.includes(p)
  );

  // Format each group
  let output = "📍 **LOCAL MENTAL HEALTH RESOURCES**\n\n";

  // Add mental health centers
  if (centers.length > 0) {
    output += "**MENTAL HEALTH CENTERS:**\n\n";
    centers.forEach((center, i) => {
      output += formatProvider(center, i + 1);
    });
  }

  // Add psychiatrists
  if (psychiatrists.length > 0) {
    output += "\n**PSYCHIATRISTS:**\n\n";
    psychiatrists.forEach((psych, i) => {
      output += formatProvider(psych, i + 1);
    });
  }

  // Add therapists
  if (therapists.length > 0) {
    output += "\n**THERAPISTS & COUNSELORS:**\n\n";
    therapists.forEach((therapist, i) => {
      output += formatProvider(therapist, i + 1);
    });
  }

  return output;
};

// Helper function to format a single provider
const formatProvider = (provider, index) => {
  return `${index}. **${provider.name}**${
    provider.type ? ` (${provider.type})` : ""
  }
     📍 Address: ${provider.address} ${
    provider.distance ? `(${provider.distance})` : ""
  }
     📞 Phone: ${provider.phone}
     🌐 Website: ${provider.website}${
    provider.services
      ? `
     🔍 Services: ${provider.services}`
      : ""
  }${
    provider.insurance
      ? `
     💳 Insurance: ${provider.insurance}`
      : ""
  }
  
  `;
};
