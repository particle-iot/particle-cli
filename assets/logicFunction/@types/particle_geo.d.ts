declare module 'particle:geo' {
    namespace Geo {
        export interface Location {
            distance: number,
            lat: number,
            lon: number,
            name: string,
            admin1: string,
            admin2: string,
            cc: string
        }

        /**
         * Does a reverse geocode lookup for a lat/lon to find the nearest city
         */
        export function reverseGeocode(lat: number, lon: number): Location
    }

    export = Geo;
}
