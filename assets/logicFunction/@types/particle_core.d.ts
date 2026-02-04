declare module 'particle:core' {
    namespace Particle {
        /***********************************************LEDGER**************************************************************/
        export const MERGE: "Merge";
        export const REPLACE: "Replace";
        export interface Ledger {
            /**
             * Gets the current value of the ledger instance
             * An empty ledger will return { updatedAt: null, data: {} }
             * @returns {Object} the current value of the ledger instance
             * @throws {Error} if the ledger doesn't exist or there was an error getting the ledger instance
             */
            get(): { updatedAt: string | null, data: Record<string, any> },

            /**
             * Sets the value of the ledger instance. If the ledger instance does not exist, it will be created.
             *
             * @param data The data you would like to put into the ledger instance
             * @param setMode Whether to replace or merge the new data into the ledger instance. Defaults to Replace. You can use the constants MERGE and REPLACE here
             * @throws {Error} if the ledger doesn't exist or there was an error setting the ledger instance
             */
            set(data: Record<string, any>, setMode: "Replace" | "Merge"): null,

            /**
             * Deletes the ledger instance data
             * @throws {Error} if there was an error deleting the ledger instance
             */
            delete(): null
        }
        /**
         * Gets a ledger object which allows you to store data in the cloud. The scope value will automatically be picked
         * based on the trigger's context. If you want to use a different scope value, you can provide a deviceId or productId
         * depending on your needs in the second param.
         *
         * If the trigger contains a deviceId and productId, we will pass those to ledger and use what the ledger definition requires
         *
         * @param name a unique name regardless of the definition's scope
         * @param scopeValues the override scope values if you want to ignore the logic trigger or are using a scheduled logic trigger
         */
        export function ledger(name: string, scopeValues?: { deviceId?: string, productId?: number }): Ledger;

        /***********************************************CONTEXT*************************************************************/
        export interface FunctionInfo {
            ownerId: string;
            logicFunctionId: string;
        }

        export interface TriggerInfo {
            triggerEventId?: string;
            triggeredAt: string;
        }

        export interface EventInfo {
            publishedAt: string;
            eventName: string;
            eventData?: string;
            deviceId: string;
            productId?: number;
            userId?: string;
        }

        export interface ScheduledInfo {
            scheduledAt: string;
            startAt: string;
            endAt?: string;
        }

        export interface LedgerChangeInfo {
            changedAt: string;
            changeType: 'set' | 'delete';
            name: string;
            scope: string;
            data: Record<string, any>
        }

        /**
         * The context object that is passed to the function when it is invoked.
         * The event, scheduled and ledgerChange properties will only be present if the function was invoked by that type of trigger
         * and only one of them will be present at a time (logic functions can only have one type of trigger).
         */
        export interface FunctionContext {
            functionInfo: FunctionInfo,
            trigger: TriggerInfo,
            secrets: Record<string, string | null>,
            env: Record<string, string>,
            event?: EventInfo,
            scheduled?: ScheduledInfo,
            ledgerChange?: LedgerChangeInfo
        }

        /**
         * Returns an object containing the raw context, trigger and its details.
         */
        export function getContext(): FunctionContext;

        /***********************************************PUBLISH*************************************************************/
        /**
         * Synchronously emits a Particle event message. Note that non-string values for `data` will be stringified
         *
         * @param name The name of the event
         * @param data The particle publish data
         * @param options Allows specifying how the data is published
         * @param options.productId Publish to the event stream of this product
         * @param options.asDeviceId Publish the event as if it came from this device.
         * @throws {Error} if there was an error publishing the event
         */
        export function publish(name: string, data: any | undefined, options: { productId: number, asDeviceId: string }): null;

        /***********************************************PARTICLE API********************************************************/
        export interface ParticleApiResponse {
            status: number;
            body: Record<string, any>;
        }
        
        export interface ListDeviceOptions {
            groups?: string[];
            sortAttr?: 'deviceId' | 'firmwareVersion' | 'lastHeard' | 'deviceName';
            sortDir?: 'asc' | 'desc';
            page?: number;
            perPage?: number;
        }

        /** https://docs.particle.io/reference/cloud-apis/api/#list-devices-in-a-product */
        export function listDevices(productIdOrSlug: string | number, options?: ListDeviceOptions): Promise<ParticleApiResponse>;

        /** https://docs.particle.io/reference/cloud-apis/api/#get-device-information */
        export function getDevice(deviceId: string): Promise<ParticleApiResponse>;

        /** https://docs.particle.io/reference/cloud-apis/api/#get-last-known-device-vitals */
        export function getLastDeviceVitals(deviceId: string): Promise<ParticleApiResponse>;

        export interface GetDeviceLocationOptions {
            dateRange?: string,
            rectBl?: string,
            rectTr?: string,
        }

        /** https://docs.particle.io/reference/cloud-apis/api/#query-location-for-one-device-within-a-product */
        export function getDeviceLocation(productIdOrSlug: string | number, deviceId: string, options?: GetDeviceLocationOptions): Promise<ParticleApiResponse>;

        /** https://docs.particle.io/reference/cloud-apis/api/#list-integrations */
        export function listIntegrations(productIdOrSlug: string | number): Promise<ParticleApiResponse>;

        /** https://docs.particle.io/reference/cloud-apis/api/#get-integration */
        export function getIntegration(productIdOrSlug: string | number, integrationId: string): Promise<ParticleApiResponse>;

        export interface IntegrationsMetricsOptions {
            startDate?: string;
            endDate?: string;
            bucketSize?: number;
            productFw?: number;
            deviceOsVersion?: string,
            deviceGroup?: string
        }
        
        /** https://docs.particle.io/reference/cloud-apis/api/#get-integration-traffic-health-metrics */
        export function integrationsMetrics(productIdOrSlug: string | number, options?: IntegrationsMetricsOptions): Promise<ParticleApiResponse>;

        /** https://docs.particle.io/reference/cloud-apis/api/#list-products */
        export function listProducts(): Promise<ParticleApiResponse>;

        /** https://docs.particle.io/reference/cloud-apis/api/#list-products */
        export function listUserProducts(): Promise<ParticleApiResponse>;

        /** https://docs.particle.io/reference/cloud-apis/api/#list-products */
        export function listOrgProducts(orgIdOrSlug: string): Promise<ParticleApiResponse>;

        /** https://docs.particle.io/reference/cloud-apis/api/#retrieve-a-product */
        export function getProduct(productIdOrSlug: string | number): Promise<ParticleApiResponse>;

        /** https://docs.particle.io/reference/cloud-apis/api/#retrieve-a-product */
        export function getOrgProduct(orgIdOrSlug: string, productIdOrSlug: string | number): Promise<ParticleApiResponse>;
    }

    export = Particle;
}
