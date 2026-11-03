import { createContext, useContext } from "react";

// everything the trip pages share: the trip, the money summary, and helpers to reload them
export const TripContext = createContext(null);
export const useTrip = () => useContext(TripContext);
