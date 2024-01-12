declare module 'particle:core' {
    namespace Particle {
        /***********************************************LEDGER**************************************************************/
        export const MERGE: "Merge";
        export const REPLACE: "Replace";
        export interface Ledger {
            /**
             * Gets the current value of the ledger.
             * Empty ledger returns {}, error returns null
             * @returns {Object} the current value of the ledger
             * @throws {Error} if the ledger doesn't exist or there was an error getting the ledger instance
             */
            get(): { updatedAt: string, data: Record<string, any> },

            /**
             * Sets the value of the ledger. If the ledger does not exist, it will be created.
             *
             * @param data The data you would like to put into the ledger
             * @param setMode Whether to replace or merge the new data into the ledger. Defaults to Replace. You can use the constants MERGE and REPLACE here
             * @throws {Error} if the ledger doesn't exist or there was an error setting the ledger instance
             */
            set(data: Record<string, any>, setMode: "Replace" | "Merge"): null,

            /**
             * Deletes the ledger data
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
            functionInfo: FunctionInfo;
            trigger: TriggerInfo;
            event?: EventInfo;
            scheduled?: ScheduledInfo;
            ledgerChange?: LedgerChangeInfo;
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
    }

    export = Particle;
}
