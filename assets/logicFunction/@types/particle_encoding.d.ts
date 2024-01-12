declare module 'particle:encoding' {
    namespace Encoding {
        /**
         * Converts a byte array to a UTF-8 string
         * @param input The byte array to convert
         * @returns {string} The converted string
         */
        export function bytesToString(input: number[]): string;
        /**
         * Converts a UTF-8 string to a byte array
         * @param input The string to convert
         * @returns {number[]} The byte array representing this string
         */
        export function stringToBytes(input: string): number[];
        /**
         * Encodes a string or byte array to base64 (RFC 3548)
         * @param input The string or byte array to encode
         * @returns {string} The base64 encoded string
         */
        export function base64Encode(input: string | number[]): string;
        /**
         * Decodes a base64 (RFC 3548) string to a byte array
         * @param input The base64 string to decode
         * @returns {number[]} The decoded byte array
         */
        export function base64Decode(input: string): number[];
        /**
         * Encodes a string or byte array to base85 (RFC1924)
         * @param input The string or byte array to encode
         * @returns {string} The base85 encoded string
         */
        export function base85Encode(input: string | number[]): string;
        /**
         * Decodes a base85 (RFC1924) string to a byte array
         * @param input The base85 string to decode
         * @returns {number[]} The decoded byte array
         */
        export function base85Decode(input: string): number[];
    }

    export = Encoding;
}
