declare type MethodType = 'idb' | 'native' | 'localstorage' | 'simulate' | 'server';

interface BroadcastChannelEventMap {
    message: MessageEvent;
    messageerror: MessageEvent;
}

export interface BroadcastMethod<State = object> {
    type: string;
    microSeconds(): number;
    create(channelName: string, options: BroadcastChannelOptions): Promise<State> | State;
    close(channelState: State): void;
    onMessage(channelState: State, callback: (args: any) => void): void;
    postMessage(channelState: State, message: any): Promise<any>;
    canBeUsed(options: BroadcastChannelOptions): boolean;
    averageResponseTime(): number;
}

export type BroadcastChannelOptions = {
    type?: MethodType;
    methods?: BroadcastMethod[] | BroadcastMethod;
    webWorkerSupport?: boolean;
    prepareDelay?: number;
    idb?: {
        ttl?: number;
        fallbackInterval?: number;
        onclose?: () => void;
    };
};

declare type EventContext = 'message' | 'internal';

declare type OnMessageHandler<T> = ((this: BroadcastChannel, ev: T) => any) | null;

/**
 * api as defined in
 * @link https://html.spec.whatwg.org/multipage/web-messaging.html#broadcasting-to-other-browsing-contexts
 * @link https://github.com/Microsoft/TypeScript/blob/master/src/lib/webworker.generated.d.ts#L325
 */
export class BroadcastChannel<T = any> {
    constructor(name: string, opts?: BroadcastChannelOptions);
    readonly id: number;
    readonly name: string;
    readonly options: BroadcastChannelOptions;
    readonly type: MethodType;
    readonly isClosed: boolean;

    postMessage(msg: T): Promise<void>;
    close(): Promise<void>;

    onmessage: OnMessageHandler<T>;

    // not defined in the offical standard
    addEventListener(type: EventContext, handler: OnMessageHandler<T>): void;
    removeEventListener(type: EventContext, handler: OnMessageHandler<T>): void;
}
// statics
export function enforceOptions(opts?: BroadcastChannelOptions | false | null): void;

export const OPEN_BROADCAST_CHANNELS: Set<BroadcastChannel>;
