// Messages that we'll send to the client

// Representing a person's position
export type Position = {
  lat: number;
  lng: number;
  id: string;
  city?: string;
  country?: string;
};

export type OutgoingMessage =
  | {
      type: "add-marker";
      position: Position;
    }
  | {
      type: "remove-marker";
      id: string;
    };

// Add the type definition for Brave Local Search results
export type BraveLocalSearchResult = {
  title: string;
  address?: string;
  rating?: number;
  review_count?: number;
  phone?: string;
  website?: string;
  thumbnail?: string; // URL for an image if available
  // Add other relevant fields as needed based on the actual API response
};
